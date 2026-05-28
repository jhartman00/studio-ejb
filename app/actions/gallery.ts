"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { bumpGallery } from "@/lib/cache";

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

const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, and dashes");

const galleryUpsertSchema = z.object({
  id: z.number().int().nullable().optional(),
  slug: slugSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  tag: z.enum(["ceramics", "art", "necklaces"]),
  image_url: z.string().min(1).max(2000),
  image_alt: z.string().max(300).optional().nullable(),
  image_width: z.number().int().positive().nullable().optional(),
  image_height: z.number().int().positive().nullable().optional(),
  price_note: z.string().max(200).optional().nullable(),
  display_order: z.number().int().default(0),
  is_featured: z.boolean().default(false),
  show_description: z.boolean().default(true),
  show_price: z.boolean().default(true),
});

export type GalleryUpsertInput = z.input<typeof galleryUpsertSchema>;
export type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

export async function galleryUpsertAction(
  raw: GalleryUpsertInput,
): Promise<ActionResult> {
  const h = await headers();
  if (!originMatchesHeaders(h)) return { ok: false, error: "bad origin" };
  const adm = await requireAdmin();
  if (!adm.ok) return { ok: false, error: "not authenticated" };

  const parsed = galleryUpsertSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  const v = parsed.data;
  try {
    let id: number;
    if (v.id) {
      const { rows } = await sql<{ id: number }>`
        update gallery_items set
          slug = ${v.slug},
          title = ${v.title},
          description = ${v.description ?? null},
          tag = ${v.tag},
          image_url = ${v.image_url},
          image_alt = ${v.image_alt ?? null},
          image_width = ${v.image_width ?? null},
          image_height = ${v.image_height ?? null},
          price_note = ${v.price_note ?? null},
          display_order = ${v.display_order},
          is_featured = ${v.is_featured},
          show_description = ${v.show_description},
          show_price = ${v.show_price},
          updated_at = now()
        where id = ${v.id}
        returning id
      `;
      if (rows.length === 0) return { ok: false, error: "not found" };
      id = rows[0]!.id;
    } else {
      const { rows } = await sql<{ id: number }>`
        insert into gallery_items (
          slug, title, description, tag, image_url, image_alt,
          image_width, image_height, price_note, display_order, is_featured,
          show_description, show_price
        ) values (
          ${v.slug}, ${v.title}, ${v.description ?? null}, ${v.tag},
          ${v.image_url}, ${v.image_alt ?? null},
          ${v.image_width ?? null}, ${v.image_height ?? null},
          ${v.price_note ?? null}, ${v.display_order}, ${v.is_featured},
          ${v.show_description}, ${v.show_price}
        )
        returning id
      `;
      id = rows[0]!.id;
    }

    bumpGallery();
    revalidatePath("/gallery");
    revalidatePath("/");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function galleryDeleteAction(id: number): Promise<ActionResult> {
  const h = await headers();
  if (!originMatchesHeaders(h)) return { ok: false, error: "bad origin" };
  const adm = await requireAdmin();
  if (!adm.ok) return { ok: false, error: "not authenticated" };

  try {
    await sql`delete from gallery_items where id = ${id}`;
    bumpGallery();
    revalidatePath("/gallery");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
