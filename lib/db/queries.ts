import { unstable_cache } from "next/cache";
import { sql } from "./index";
import { parseSection, type SectionKey, type SectionData } from "../content/schemas";
import { tags } from "../cache";
import type { CategoryValue } from "../content/categories";

export type SiteContentRow = {
  id: number;
  page: string;
  section: string;
  data: unknown;
  enabled: boolean;
  sort_order: number;
  updated_at: string;
};

export type GalleryItem = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  tag: CategoryValue;
  image_url: string;
  image_alt: string | null;
  image_width: number | null;
  image_height: number | null;
  price_note: string | null;
  display_order: number;
  is_featured: boolean;
  show_description: boolean;
  show_price: boolean;
};

export type TradeShow = {
  id: number;
  name: string;
  city: string | null;
  venue: string | null;
  booth: string | null;
  starts_at: string;
  ends_at: string;
  url: string | null;
  notes: string | null;
  is_published: boolean;
};

export type EmailSubscriber = {
  id: number;
  email: string;
  status: "active" | "unsubscribed" | "bounced";
  source: string | null;
  unsubscribe_token: string;
  unsubscribe_token_version: number;
  subscribed_at: string;
  unsubscribed_at: string | null;
};

export type EmailCampaign = {
  id: number;
  subject: string;
  preheader: string | null;
  body_html: string;
  audience: string;
  status: "draft" | "queued" | "sending" | "sent" | "failed" | "cancelled";
  total_recipients: number;
  success_count: number;
  failure_count: number;
  heartbeat_at: string | null;
  sent_at: string | null;
  created_at: string;
};

// --- site_content -----------------------------------------------------

export const getPageSections = (page: string) =>
  unstable_cache(
    async () => {
      const { rows } = await sql<SiteContentRow>`
        select id, page, section, data, enabled, sort_order, updated_at
        from site_content
        where page = ${page}
        order by sort_order asc, id asc
      `;
      return rows;
    },
    ["site_content", page],
    { tags: [tags.siteContent(page)] },
  )();

export async function getAllSections() {
  const { rows } = await sql<SiteContentRow>`
    select id, page, section, data, enabled, sort_order, updated_at
    from site_content
    order by page asc, sort_order asc, id asc
  `;
  return rows;
}

export function parseSectionRow<K extends SectionKey>(row: SiteContentRow) {
  return parseSection<K>(row.page, row.section, row.data);
}

export function pickSection<K extends SectionKey>(
  rows: SiteContentRow[],
  page: string,
  section: string,
): { row: SiteContentRow | null; data: SectionData<K> } {
  const row = rows.find((r) => r.page === page && r.section === section) ?? null;
  const parsed = parseSection<K>(page, section, row?.data);
  return {
    row,
    data: parsed.ok ? parsed.data : parsed.fallback,
  };
}

// --- gallery ----------------------------------------------------------

export const getGalleryItems = () =>
  unstable_cache(
    async () => {
      const { rows } = await sql<GalleryItem>`
        select id, slug, title, description, tag, image_url, image_alt,
               image_width, image_height, price_note, display_order, is_featured,
               show_description, show_price
        from gallery_items
        order by display_order asc, id asc
      `;
      return rows;
    },
    ["gallery_items", "all"],
    { tags: [tags.gallery()] },
  )();

export async function getGalleryItemById(id: number): Promise<GalleryItem | null> {
  const { rows } = await sql<GalleryItem>`
    select id, slug, title, description, tag, image_url, image_alt,
           image_width, image_height, price_note, display_order, is_featured,
           show_description, show_price
    from gallery_items
    where id = ${id}
  `;
  return rows[0] ?? null;
}

// --- trade shows ------------------------------------------------------

export const getPublishedShows = () =>
  unstable_cache(
    async () => {
      const { rows } = await sql<TradeShow>`
        select id, name, city, venue, booth, starts_at, ends_at, url, notes, is_published
        from trade_shows
        where is_published = true
        order by starts_at asc
      `;
      return rows;
    },
    ["trade_shows", "published"],
    { tags: [tags.shows()] },
  )();

export async function getAllShows() {
  const { rows } = await sql<TradeShow>`
    select id, name, city, venue, booth, starts_at, ends_at, url, notes, is_published
    from trade_shows
    order by starts_at asc
  `;
  return rows;
}

export async function getNextUpcomingShow(): Promise<TradeShow | null> {
  const { rows } = await sql<TradeShow>`
    select id, name, city, venue, booth, starts_at, ends_at, url, notes, is_published
    from trade_shows
    where is_published = true and ends_at >= now()
    order by starts_at asc
    limit 1
  `;
  return rows[0] ?? null;
}

// --- subscribers ------------------------------------------------------

export const getSubscriberStats = () =>
  unstable_cache(
    async () => {
      const { rows } = await sql<{
        active: string;
        added_week: string;
        unsubbed_week: string;
      }>`
        select
          count(*) filter (where status = 'active')::text as active,
          count(*) filter (where status = 'active' and subscribed_at > now() - interval '7 days')::text as added_week,
          count(*) filter (where status = 'unsubscribed' and unsubscribed_at > now() - interval '7 days')::text as unsubbed_week
        from email_subscribers
      `;
      const r = rows[0] ?? { active: "0", added_week: "0", unsubbed_week: "0" };
      return {
        active: Number(r.active),
        addedWeek: Number(r.added_week),
        unsubbedWeek: Number(r.unsubbed_week),
      };
    },
    ["subscribers", "stats"],
    { tags: [tags.subscribers()] },
  )();

export const getAllSubscribers = () =>
  unstable_cache(
    async () => {
      const { rows } = await sql<EmailSubscriber>`
        select id, email, status, source, unsubscribe_token, unsubscribe_token_version,
               subscribed_at, unsubscribed_at
        from email_subscribers
        order by subscribed_at desc
      `;
      return rows;
    },
    ["subscribers", "all"],
    { tags: [tags.subscribers()] },
  )();

// --- campaigns --------------------------------------------------------

export const getCampaigns = () =>
  unstable_cache(
    async () => {
      const { rows } = await sql<EmailCampaign>`
        select id, subject, preheader, body_html, audience, status,
               total_recipients, success_count, failure_count,
               heartbeat_at, sent_at, created_at
        from email_campaigns
        order by created_at desc
      `;
      return rows;
    },
    ["campaigns", "all"],
    { tags: [tags.campaigns()] },
  )();

export async function getCampaignById(id: number): Promise<EmailCampaign | null> {
  const { rows } = await sql<EmailCampaign>`
    select id, subject, preheader, body_html, audience, status,
           total_recipients, success_count, failure_count,
           heartbeat_at, sent_at, created_at
    from email_campaigns
    where id = ${id}
  `;
  return rows[0] ?? null;
}

// --- dashboard counts -------------------------------------------------

export const getDashboardCounts = () =>
  unstable_cache(
    async () => {
      const { rows } = await sql<{
        active_subs: string;
        gallery_count: string;
        upcoming_shows: string;
      }>`
        select
          (select count(*) from email_subscribers where status='active')::text as active_subs,
          (select count(*) from gallery_items)::text as gallery_count,
          (select count(*) from trade_shows where is_published=true and ends_at >= now())::text as upcoming_shows
      `;
      const r = rows[0] ?? { active_subs: "0", gallery_count: "0", upcoming_shows: "0" };
      return {
        activeSubs: Number(r.active_subs),
        galleryCount: Number(r.gallery_count),
        upcomingShows: Number(r.upcoming_shows),
      };
    },
    ["dashboard", "counts"],
    { tags: [tags.subscribers(), tags.gallery(), tags.shows()] },
  )();
