"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { bumpShows } from "@/lib/cache";

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

const showUpsertSchema = z
  .object({
    id: z.number().int().nullable().optional(),
    name: z.string().min(1).max(200),
    city: z.string().max(120).optional().nullable(),
    venue: z.string().max(200).optional().nullable(),
    booth: z.string().max(40).optional().nullable(),
    starts_at: z.string().min(1),
    ends_at: z.string().min(1),
    url: z.string().max(500).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    is_published: z.boolean().default(true),
  })
  .refine(
    (v) => !Number.isNaN(Date.parse(v.starts_at)) && !Number.isNaN(Date.parse(v.ends_at)),
    { message: "starts_at and ends_at must be valid ISO timestamps" },
  );

export type ShowUpsertInput = z.input<typeof showUpsertSchema>;
export type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

export async function showUpsertAction(raw: ShowUpsertInput): Promise<ActionResult> {
  const h = await headers();
  if (!originMatchesHeaders(h)) return { ok: false, error: "bad origin" };
  const adm = await requireAdmin();
  if (!adm.ok) return { ok: false, error: "not authenticated" };

  const parsed = showUpsertSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const v = parsed.data;

  try {
    let id: number;
    if (v.id) {
      const { rows } = await sql<{ id: number }>`
        update trade_shows set
          name = ${v.name},
          city = ${v.city ?? null},
          venue = ${v.venue ?? null},
          booth = ${v.booth ?? null},
          starts_at = ${v.starts_at},
          ends_at = ${v.ends_at},
          url = ${v.url ?? null},
          notes = ${v.notes ?? null},
          is_published = ${v.is_published}
        where id = ${v.id}
        returning id
      `;
      if (rows.length === 0) return { ok: false, error: "not found" };
      id = rows[0]!.id;
    } else {
      const { rows } = await sql<{ id: number }>`
        insert into trade_shows (
          name, city, venue, booth, starts_at, ends_at, url, notes, is_published
        ) values (
          ${v.name}, ${v.city ?? null}, ${v.venue ?? null}, ${v.booth ?? null},
          ${v.starts_at}, ${v.ends_at},
          ${v.url ?? null}, ${v.notes ?? null}, ${v.is_published}
        )
        returning id
      `;
      id = rows[0]!.id;
    }

    bumpShows();
    revalidatePath("/shows");
    revalidatePath("/");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function showDeleteAction(id: number): Promise<ActionResult> {
  const h = await headers();
  if (!originMatchesHeaders(h)) return { ok: false, error: "bad origin" };
  const adm = await requireAdmin();
  if (!adm.ok) return { ok: false, error: "not authenticated" };

  try {
    await sql`delete from trade_shows where id = ${id}`;
    bumpShows();
    revalidatePath("/shows");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
