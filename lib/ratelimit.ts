import { kv } from "@vercel/kv";

// Fixed-window rate limiter. Vercel KV when available, in-memory Map
// fallback for local dev and previews without a KV store provisioned.
//
// Buckets: { key, window seconds, max hits }. Returns { ok, remaining,
// resetSec, lockedUntilSec? }. Login also uses a lockout key: 15 min
// after 5 fails, set independently from the normal window counter.

const hasKv =
  !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

type MemEntry = { count: number; expiresAt: number };
const memStore = new Map<string, MemEntry>();

function memIncr(key: string, ttlSec: number): { count: number; resetSec: number } {
  const now = Date.now();
  const ms = ttlSec * 1000;
  const cur = memStore.get(key);
  if (!cur || cur.expiresAt <= now) {
    const entry = { count: 1, expiresAt: now + ms };
    memStore.set(key, entry);
    return { count: 1, resetSec: ttlSec };
  }
  cur.count += 1;
  return { count: cur.count, resetSec: Math.max(1, Math.ceil((cur.expiresAt - now) / 1000)) };
}

function memGet(key: string): string | null {
  const e = memStore.get(key);
  if (!e || e.expiresAt <= Date.now()) {
    memStore.delete(key);
    return null;
  }
  return String(e.count);
}

function memSetWithTtl(key: string, value: string, ttlSec: number) {
  memStore.set(key, { count: Number(value), expiresAt: Date.now() + ttlSec * 1000 });
}

async function incrWithExpire(key: string, ttlSec: number): Promise<{ count: number; resetSec: number }> {
  if (!hasKv) return memIncr(key, ttlSec);
  try {
    const count = (await kv.incr(key)) as number;
    if (count === 1) await kv.expire(key, ttlSec);
    const ttl = (await kv.ttl(key)) as number;
    return { count, resetSec: ttl > 0 ? ttl : ttlSec };
  } catch {
    return memIncr(key, ttlSec);
  }
}

async function getValue(key: string): Promise<string | null> {
  if (!hasKv) return memGet(key);
  try {
    const v = await kv.get<string>(key);
    return v == null ? null : String(v);
  } catch {
    return memGet(key);
  }
}

async function setWithTtl(key: string, value: string, ttlSec: number): Promise<void> {
  if (!hasKv) return memSetWithTtl(key, value, ttlSec);
  try {
    await kv.set(key, value, { ex: ttlSec });
  } catch {
    memSetWithTtl(key, value, ttlSec);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetSec: number;
  lockedUntilSec?: number;
};

export async function rateLimit(opts: {
  bucket: string;
  identifier: string;
  windowSec: number;
  max: number;
}): Promise<RateLimitResult> {
  const key = `rl:${opts.bucket}:${opts.identifier}`;
  const { count, resetSec } = await incrWithExpire(key, opts.windowSec);
  const remaining = Math.max(0, opts.max - count);
  return {
    ok: count <= opts.max,
    remaining,
    resetSec,
  };
}

export async function recordLoginFailure(ip: string): Promise<{ failures: number; lockedUntilSec?: number }> {
  const failKey = `loginfail:${ip}`;
  const { count } = await incrWithExpire(failKey, 60 * 15);
  if (count >= 5) {
    const lockoutSec = 60 * 15;
    await setWithTtl(`loginlock:${ip}`, "1", lockoutSec);
    return { failures: count, lockedUntilSec: lockoutSec };
  }
  return { failures: count };
}

export async function isLoginLocked(ip: string): Promise<boolean> {
  const v = await getValue(`loginlock:${ip}`);
  return v !== null;
}

export async function clearLoginFailures(ip: string): Promise<void> {
  if (!hasKv) {
    memStore.delete(`loginfail:${ip}`);
    memStore.delete(`loginlock:${ip}`);
    return;
  }
  try {
    await kv.del(`loginfail:${ip}`);
    await kv.del(`loginlock:${ip}`);
  } catch {
    // ignore
  }
}

// Best-effort IP extraction. NextRequest doesn't have a stable accessor,
// so fall back to standard proxy headers in order. Returns "unknown" if
// nothing is set (acceptable for rate limiting: one shared bucket).
export function ipFromHeaders(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const vercel = h.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim();
  return "unknown";
}
