"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { SECTION_SCHEMAS, type SectionKey } from "@/lib/content/schemas";
import { sanitizeHtml } from "@/lib/sanitize";
import { bumpSiteContent } from "@/lib/cache";

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

function deepSanitize<T>(value: T): T {
  if (typeof value === "string") return value as T;
  if (Array.isArray(value)) return value.map((v) => deepSanitize(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.endsWith("_html") && typeof v === "string") {
        out[k] = sanitizeHtml(v);
      } else {
        out[k] = deepSanitize(v);
      }
    }
    return out as T;
  }
  return value;
}

export type SaveSectionInput = {
  page: string;
  section: string;
  data: unknown;
  enabled?: boolean;
  sort_order?: number;
};

export type SaveSectionResult = { ok: true } | { ok: false; error: string };

export async function saveSectionAction(
  input: SaveSectionInput,
): Promise<SaveSectionResult> {
  const h = await headers();
  if (!originMatchesHeaders(h)) return { ok: false, error: "bad origin" };

  const adm = await requireAdmin();
  if (!adm.ok) return { ok: false, error: "not authenticated" };

  const key = `${input.page}:${input.section}` as SectionKey;
  const schema = SECTION_SCHEMAS[key];
  if (!schema) return { ok: false, error: `unknown section ${key}` };

  // Strict parse on write. Sanitize *_html fields before validate.
  const sanitized = deepSanitize(input.data);
  const parsed = schema.safeParse(sanitized);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }

  const enabled = typeof input.enabled === "boolean" ? input.enabled : true;
  const sortOrder = typeof input.sort_order === "number" ? input.sort_order : 0;

  try {
    await sql`
      insert into site_content (page, section, data, enabled, sort_order, updated_at)
      values (
        ${input.page},
        ${input.section},
        ${JSON.stringify(parsed.data)}::jsonb,
        ${enabled},
        ${sortOrder},
        now()
      )
      on conflict (page, section) do update set
        data = excluded.data,
        enabled = excluded.enabled,
        sort_order = excluded.sort_order,
        updated_at = now()
    `;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  bumpSiteContent(input.page);
  revalidatePath(`/${input.page === "home" ? "" : input.page}`);
  return { ok: true };
}

const sectionTogglePayload = z.object({
  page: z.string().min(1).max(64),
  section: z.string().min(1).max(64),
  enabled: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export async function toggleSectionAction(
  input: z.infer<typeof sectionTogglePayload>,
): Promise<SaveSectionResult> {
  const h = await headers();
  if (!originMatchesHeaders(h)) return { ok: false, error: "bad origin" };
  const adm = await requireAdmin();
  if (!adm.ok) return { ok: false, error: "not authenticated" };

  const parsed = sectionTogglePayload.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const { page, section, enabled, sort_order } = parsed.data;

  try {
    if (enabled !== undefined && sort_order !== undefined) {
      await sql`
        update site_content
        set enabled = ${enabled}, sort_order = ${sort_order}, updated_at = now()
        where page = ${page} and section = ${section}
      `;
    } else if (enabled !== undefined) {
      await sql`
        update site_content
        set enabled = ${enabled}, updated_at = now()
        where page = ${page} and section = ${section}
      `;
    } else if (sort_order !== undefined) {
      await sql`
        update site_content
        set sort_order = ${sort_order}, updated_at = now()
        where page = ${page} and section = ${section}
      `;
    } else {
      return { ok: true };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  bumpSiteContent(page);
  return { ok: true };
}
