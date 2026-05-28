import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import type { NextRequest } from "next/server";

// Cookie name uses the __Host- prefix: requires Secure + Path=/ + no Domain.
// In dev, browsers refuse __Host- without Secure; we fall back to a plain
// cookie name when NODE_ENV !== 'production'.
export const ADMIN_COOKIE_PROD = "__Host-sejb_admin";
export const ADMIN_COOKIE_DEV = "sejb_admin_dev";
export const ADMIN_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? ADMIN_COOKIE_PROD : ADMIN_COOKIE_DEV;

export const ADMIN_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const CURRENT_KID = 1;

type SessionPayload = {
  kid: number;
  iat: number; // issued_at, seconds since epoch
};

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET missing or too short");
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

export function signSession(payload: SessionPayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = createHmac("sha256", getSecret()).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

export function verifySession(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  let expected: Buffer;
  try {
    expected = createHmac("sha256", getSecret()).update(body).digest();
  } catch {
    return null;
  }
  let got: Buffer;
  try {
    got = b64urlDecode(sig);
  } catch {
    return null;
  }
  if (got.length !== expected.length) return null;
  if (!timingSafeEqual(got, expected)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
  if (payload.kid !== CURRENT_KID) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.iat !== "number") return null;
  if (now - payload.iat > ADMIN_MAX_AGE) return null;
  if (payload.iat > now + 60) return null; // clock skew tolerance
  return payload;
}

// Pulls the session cookie from `next/headers`. Works in Server Actions,
// Server Components, route handlers.
export async function getCurrentSession(): Promise<SessionPayload | null> {
  const c = await cookies();
  const tok = c.get(ADMIN_COOKIE_NAME)?.value;
  if (!tok) return null;
  return verifySession(tok);
}

// Pulls the cookie directly off a NextRequest. Use in route handlers
// when you already have the request object.
export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  const tok = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!tok) return null;
  return verifySession(tok);
}

export type RequireAdminResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; reason: string };

export async function requireAdmin(req?: NextRequest): Promise<RequireAdminResult> {
  const session = req ? getSessionFromRequest(req) : await getCurrentSession();
  if (!session) return { ok: false, reason: "not authenticated" };
  return { ok: true, session };
}

// CSRF defense-in-depth: the SameSite=Strict cookie blocks cross-origin
// POSTs, and Server Actions carry an opaque action ID. We additionally
// require Origin (or Referer) to match host on every admin mutation.
export function checkOrigin(req: NextRequest | Request): boolean {
  const headers =
    "headers" in req && typeof req.headers.get === "function" ? req.headers : null;
  if (!headers) return false;
  const origin = headers.get("origin");
  const host = headers.get("host");
  if (!host) return false;
  if (origin) {
    try {
      const u = new URL(origin);
      return u.host === host;
    } catch {
      return false;
    }
  }
  // Fall back to Referer for clients that omit Origin on same-origin POSTs.
  const referer = headers.get("referer");
  if (!referer) return false;
  try {
    const u = new URL(referer);
    return u.host === host;
  } catch {
    return false;
  }
}

// Constant-time password compare. Hash both sides to a fixed 32-byte
// sha256 buffer first so length doesn't leak.
export function comparePasswords(input: string, expected: string): boolean {
  if (!expected) return false;
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}
