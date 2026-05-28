import { z } from "zod";

// Each section's data column is validated through one of these schemas at
// the read boundary. Adding a section: add a schema entry, add a fallback,
// then add a renderer. Read path uses parseSection (lenient, falls back).
// Write path uses .parse() (throws on bad input).

const heroSchema = z.object({
  headline: z.string().default(""),
  subhead: z.string().default(""),
  image_url: z.string().default(""),
  image_alt: z.string().default(""),
  image_width: z.number().nullable().default(null),
  image_height: z.number().nullable().default(null),
  cta_label: z.string().default(""),
  cta_href: z.string().default(""),
});

const featuredSchema = z.object({
  gallery_item_ids: z.array(z.number()).default([]),
});

const studioNoteSchema = z.object({
  title: z.string().default(""),
  body_html: z.string().default(""),
});

const newsletterSchema = z.object({
  title: z.string().default(""),
  body: z.string().default(""),
});

const aboutIntroSchema = z.object({
  title: z.string().default(""),
  body_html: z.string().default(""),
  portrait_url: z.string().default(""),
  portrait_alt: z.string().default(""),
  portrait_width: z.number().nullable().default(null),
  portrait_height: z.number().nullable().default(null),
});

const linkArraySchema = z.object({
  links: z
    .array(
      z.object({
        label: z.string().default(""),
        href: z.string().default(""),
      }),
    )
    .default([]),
});

const introSchema = z.object({
  title: z.string().default(""),
  body: z.string().default(""),
});

const contactMethodsSchema = z.object({
  methods: z
    .array(
      z.object({
        label: z.string().default(""),
        value: z.string().default(""),
      }),
    )
    .default([]),
});

const footerTemplateSchema = z.object({
  body_html: z.string().default(""),
});

export const SECTION_SCHEMAS = {
  "home:hero": heroSchema,
  "home:featured": featuredSchema,
  "home:studio_note": studioNoteSchema,
  "home:newsletter": newsletterSchema,
  "about:intro": aboutIntroSchema,
  "about:find_me_at": linkArraySchema,
  "contact:intro": introSchema,
  "contact:methods": contactMethodsSchema,
  "gallery:intro": introSchema,
  "shows:intro": introSchema,
  "reviews:intro": introSchema,
  "campaign:footer_template": footerTemplateSchema,
} as const;

export type SectionKey = keyof typeof SECTION_SCHEMAS;
export type SectionData<K extends SectionKey> = z.infer<(typeof SECTION_SCHEMAS)[K]>;

export type ParseResult<K extends SectionKey> =
  | { ok: true; data: SectionData<K> }
  | { ok: false; fallback: SectionData<K>; error: string };

function fallback<K extends SectionKey>(key: K): SectionData<K> {
  return SECTION_SCHEMAS[key].parse({}) as SectionData<K>;
}

export function parseSection<K extends SectionKey>(
  page: string,
  section: string,
  data: unknown,
): ParseResult<K> {
  const key = `${page}:${section}` as K;
  const schema = SECTION_SCHEMAS[key];
  if (!schema) {
    return {
      ok: false,
      fallback: {} as SectionData<K>,
      error: `unknown section ${key}`,
    };
  }
  const result = schema.safeParse(data ?? {});
  if (result.success) {
    return { ok: true, data: result.data as SectionData<K> };
  }
  return {
    ok: false,
    fallback: fallback(key),
    error: result.error.message,
  };
}

export function sectionKey(page: string, section: string): SectionKey | null {
  const k = `${page}:${section}` as SectionKey;
  return k in SECTION_SCHEMAS ? k : null;
}
