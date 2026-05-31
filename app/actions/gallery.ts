"use server";

import { headers } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { sql, query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { bumpGallery, tags } from "@/lib/cache";
import { slugify, uniqueSlug } from "@/lib/slug";
import { titleFromFilename } from "@/lib/title-from-filename";
import { optionalId } from "@/lib/zod-helpers";
import { CATEGORY_VALUES } from "@/lib/content/categories";

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
  .max(120)
  .regex(
    /^[a-z0-9-]*$/,
    "slug must be lowercase letters, numbers, and dashes",
  );

const galleryUpsertSchema = z.object({
  id: optionalId,
  slug: slugSchema.optional().default(""),
  title: z.string().max(200).optional().default(""),
  description: z.string().max(2000).optional().nullable(),
  tag: z.enum(CATEGORY_VALUES),
  image_url: z.string().min(1).max(2000),
  image_alt: z.string().max(300).optional().nullable(),
  image_width: z.number().int().positive().nullable().optional(),
  image_height: z.number().int().positive().nullable().optional(),
  price_note: z.string().max(200).optional().nullable(),
  display_order: z.number().int().default(0),
  is_featured: z.boolean().default(false),
  show_description: z.boolean().default(true),
  show_price: z.boolean().default(true),
  original_filename: z.string().max(255).optional().nullable(),
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

  // Derive title from filename when empty; default alt to title.
  let title = (v.title ?? "").trim();
  if (!title && v.original_filename) {
    title = titleFromFilename(v.original_filename);
  }
  if (!title) title = "Untitled";

  const imageAlt = v.image_alt && v.image_alt.trim().length > 0
    ? v.image_alt.trim()
    : title;

  // Resolve slug. On create or when the client left it blank, derive
  // from the title and dedupe against existing slugs (excluding the
  // current row on edit). Race window with concurrent saves is acceptable
  // here: admin is a single writer.
  let slug = (v.slug ?? "").trim();
  if (!slug) {
    try {
      const { rows: existing } = v.id
        ? await sql<{ slug: string }>`
            select slug from gallery_items where id <> ${v.id}
          `
        : await sql<{ slug: string }>`select slug from gallery_items`;
      slug = uniqueSlug(title, existing.map((r) => r.slug));
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    // Client passed a slug; normalize defensively.
    slug = slugify(slug);
  }

  try {
    let id: number;
    if (v.id) {
      const { rows } = await sql<{ id: number }>`
        update gallery_items set
          slug = ${slug},
          title = ${title},
          description = ${v.description ?? null},
          tag = ${v.tag},
          image_url = ${v.image_url},
          image_alt = ${imageAlt},
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
          ${slug}, ${title}, ${v.description ?? null}, ${v.tag},
          ${v.image_url}, ${imageAlt},
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

export async function reorderGalleryAction(
  orderedIds: number[],
): Promise<ActionResult> {
  const h = await headers();
  if (!originMatchesHeaders(h)) return { ok: false, error: "bad origin" };
  const adm = await requireAdmin();
  if (!adm.ok) return { ok: false, error: "not authenticated" };

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { ok: true };
  }
  const ids = orderedIds.map((n) => Number(n));
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) {
    return { ok: false, error: "invalid id list" };
  }

  try {
    // Single round trip: build a VALUES table of (id, idx) and join
    // against gallery_items so each row gets its new display_order.
    const valuesSql = ids
      .map((_, i) => `($${i * 2 + 1}::bigint, $${i * 2 + 2}::int)`)
      .join(", ");
    const params: (number | string)[] = [];
    ids.forEach((id, idx) => {
      params.push(id);
      params.push(idx);
    });
    await query(
      `update gallery_items set display_order = data.idx
       from (values ${valuesSql}) as data(id, idx)
       where gallery_items.id = data.id`,
      params,
    );

    bumpGallery();
    revalidateTag(tags.gallery());
    revalidatePath("/gallery");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function galleryDeleteAction(rawId: number | string): Promise<ActionResult> {
  const h = await headers();
  if (!originMatchesHeaders(h)) return { ok: false, error: "bad origin" };
  const adm = await requireAdmin();
  if (!adm.ok) return { ok: false, error: "not authenticated" };

  const id = typeof rawId === "number" ? rawId : Number(rawId);
  if (!Number.isFinite(id)) return { ok: false, error: "invalid id" };

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
