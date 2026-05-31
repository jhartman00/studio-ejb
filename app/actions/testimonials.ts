"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { bumpReviews } from "@/lib/cache";
import { optionalId } from "@/lib/zod-helpers";

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

const testimonialUpsertSchema = z.object({
  id: optionalId,
  quote: z.string().min(1).max(2000),
  attribution: z.string().min(1).max(200),
  location: z.string().max(120).optional().nullable(),
  source_label: z.string().max(120).optional().nullable(),
  display_order: z.number().int().default(0),
  is_published: z.boolean().default(true),
});

export type TestimonialUpsertInput = z.input<typeof testimonialUpsertSchema>;
export type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

export async function testimonialUpsertAction(
  raw: TestimonialUpsertInput,
): Promise<ActionResult> {
  const h = await headers();
  if (!originMatchesHeaders(h)) return { ok: false, error: "bad origin" };
  const adm = await requireAdmin();
  if (!adm.ok) return { ok: false, error: "not authenticated" };

  const parsed = testimonialUpsertSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const v = parsed.data;

  try {
    let id: number;
    if (v.id) {
      const { rows } = await sql<{ id: number }>`
        update testimonials set
          quote = ${v.quote},
          attribution = ${v.attribution},
          location = ${v.location ?? null},
          source_label = ${v.source_label ?? null},
          display_order = ${v.display_order},
          is_published = ${v.is_published}
        where id = ${v.id}
        returning id
      `;
      if (rows.length === 0) return { ok: false, error: "not found" };
      id = rows[0]!.id;
    } else {
      const { rows } = await sql<{ id: number }>`
        insert into testimonials (
          quote, attribution, location, source_label, display_order, is_published
        ) values (
          ${v.quote}, ${v.attribution}, ${v.location ?? null},
          ${v.source_label ?? null}, ${v.display_order}, ${v.is_published}
        )
        returning id
      `;
      id = rows[0]!.id;
    }

    bumpReviews();
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function testimonialDeleteAction(rawId: number | string): Promise<ActionResult> {
  const h = await headers();
  if (!originMatchesHeaders(h)) return { ok: false, error: "bad origin" };
  const adm = await requireAdmin();
  if (!adm.ok) return { ok: false, error: "not authenticated" };

  const id = typeof rawId === "number" ? rawId : Number(rawId);
  if (!Number.isFinite(id)) return { ok: false, error: "invalid id" };

  try {
    await sql`delete from testimonials where id = ${id}`;
    bumpReviews();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
