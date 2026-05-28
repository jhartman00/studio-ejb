"use server";

import { headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { bumpSubscribers } from "@/lib/cache";

function originMatchesHeaders(h: Headers): boolean {
  const host = h.get("host");
  if (!host) return false;
  const origin = h.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const ref = h.get("referer");
  if (!ref) return true;
  try {
    return new URL(ref).host === host;
  } catch {
    return false;
  }
}

const addSchema = z.object({
  email: z.string().email().max(254),
  source: z.string().max(64).optional().nullable(),
});

export type SubscribersResult = { ok: true; id?: number } | { ok: false; error: string };

export async function subscriberAddAction(
  raw: z.input<typeof addSchema>,
): Promise<SubscribersResult> {
  const h = await headers();
  if (!originMatchesHeaders(h)) return { ok: false, error: "bad origin" };
  const adm = await requireAdmin();
  if (!adm.ok) return { ok: false, error: "not authenticated" };
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const token = randomBytes(32).toString("base64url");
  try {
    const { rows } = await sql<{ id: number }>`
      insert into email_subscribers (email, source, unsubscribe_token, status)
      values (${parsed.data.email.toLowerCase()}, ${parsed.data.source ?? "manual"}, ${token}, 'active')
      on conflict (email) do update
        set status = 'active',
            unsubscribed_at = null
      returning id
    `;
    bumpSubscribers();
    return { ok: true, id: rows[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function subscriberSuppressAction(id: number): Promise<SubscribersResult> {
  const h = await headers();
  if (!originMatchesHeaders(h)) return { ok: false, error: "bad origin" };
  const adm = await requireAdmin();
  if (!adm.ok) return { ok: false, error: "not authenticated" };
  try {
    await sql`
      update email_subscribers
      set status = 'unsubscribed', unsubscribed_at = now()
      where id = ${id}
    `;
    bumpSubscribers();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
