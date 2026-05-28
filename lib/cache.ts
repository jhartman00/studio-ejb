import { revalidateTag } from "next/cache";

// Cache tag conventions for unstable_cache + revalidateTag.
//
// Tags are scoped by domain. Reads wrap data fetches in unstable_cache
// with the matching tag. Writes (Server Actions, route handlers) call
// the bumpX helper here after the mutation commits, so the next page
// render fetches fresh data instead of the cached value.
//
//   site_content:<page>    -> Public page sections for a single page.
//   gallery                -> All gallery_items reads.
//   shows                  -> All trade_shows reads.
//   reviews                -> All testimonials reads.
//   subscribers            -> Subscribers count / list reads.
//   campaigns              -> Campaign list + detail reads.
//
// Pattern: one tag per logical resource. Pages that aggregate multiple
// resources (home: site_content + gallery + shows) get revalidated when
// ANY of their underlying tags fire — Next caches per-tag, not per-key.

export const tags = {
  siteContent: (page: string) => `site_content:${page}`,
  gallery: () => "gallery",
  shows: () => "shows",
  reviews: () => "reviews",
  subscribers: () => "subscribers",
  campaigns: () => "campaigns",
} as const;

export function bumpSiteContent(page: string): void {
  revalidateTag(tags.siteContent(page));
}

export function bumpGallery(): void {
  revalidateTag(tags.gallery());
  // Home renders featured gallery items, so a gallery change must also
  // refresh home.
  revalidateTag(tags.siteContent("home"));
}

export function bumpShows(): void {
  revalidateTag(tags.shows());
  // Home renders the next upcoming show.
  revalidateTag(tags.siteContent("home"));
}

export function bumpReviews(): void {
  revalidateTag(tags.reviews());
}

export function bumpSubscribers(): void {
  revalidateTag(tags.subscribers());
}

export function bumpCampaigns(): void {
  revalidateTag(tags.campaigns());
}
