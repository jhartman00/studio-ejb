# Studio EJB Website v1 PRD (Plan v2)

Studio EJB is Emma's personal art and ceramics practice. She sells at trade shows and via Venmo. This is not yet a registered business; v1 has no e-commerce. The goal is a calm, content-driven site with an admin panel Emma can use herself from her phone, plus an opt-in email list. Shipped as one PR to `jhartman00/studio-ejb`, deployed to `studioejb.vercel.app`.

This is **plan v2**, incorporating findings from three lens reviews (security, ux, architecture). The consolidation doc is at `/tmp/studio-ejb-review-consolidated.md`.

## 1. Goals and non-goals

**Goals.** Six public pages (Home, Gallery, About, Contact, Trade Show Schedule, Reviews). Admin at `/admin` with shared password: edit text and images, reorder/toggle sections, CRUD gallery/testimonials/shows. Email capture and CAN-SPAM compliant blasts. Cream minimalist identity. Working end to end in one PR. Emma can run the admin from her phone without calling Jamie.

**Non-goals.** E-commerce, custom domain, multi-user admin, OAuth, drag-and-drop builder, image transforms beyond `next/image` defaults, analytics, search, i18n, double opt-in confirmation, bounce webhooks, automated tests beyond manual acceptance.

## 2. User personas

- **Emma (admin).** Artist, not technical. Edits text in a visual editor, uploads photos from her phone. Needs forms with clear states, not a CMS. Will not read docs. Outdoor trade-show lighting affects what she can read on her own site.
- **Public visitor.** Mobile-first, comes from Instagram or a booth QR code. 30 to 90 seconds on site. May land on a stale QR pointing at a deleted slug.
- **Email subscriber.** A few emails a year. One-click unsubscribe must work from every email (RFC 8058 + Gmail/Yahoo bulk-sender requirements).

## 3. Information architecture

**Public:**
- `/`, `/gallery`, `/about`, `/contact`, `/shows`, `/reviews`
- `/unsubscribe?token=...` (renders confirm UI, no state change)

**Admin:**
- `/admin/login`, `/admin` (dashboard)
- `/admin/pages/[slug]` for `home`, `about`, `contact`, `gallery`, `shows`, `reviews`
- `/admin/gallery` + `/admin/gallery/[id]`
- `/admin/shows` + `/admin/shows/[id]`
- `/admin/testimonials` + `/admin/testimonials/[id]`
- `/admin/subscribers`
- `/admin/campaigns` + `/admin/campaigns/new` + `/admin/campaigns/[id]`

## 4. Page-by-page specs

All public content reads from `site_content` keyed by `(page, section)`. Each section has a `data` JSON blob validated through a zod schema at the read boundary (see §6), plus `enabled` and `sort_order`. Renderers receive parsed, typed data; malformed rows render the section's empty fallback.

**Home.** Editable: hero (headline, subhead, image, CTA), featured (3 gallery item ids), studio note, newsletter copy. Auto: upcoming show (soonest future `trade_shows` row, hidden if none). Section order configurable. Empty featured: hidden. Empty newsletter copy: shows nothing (no broken form).

**Gallery.** Editable intro. Static filter chips: All, Ceramics, Art, Necklaces. Single-row chip strip with horizontal overflow scroll, active chip filled `--cream-100` + ink-900 text + 1px ink-900 border. URL updates via `replaceState`. 2-col mobile, 3-col desktop grid. Each tile is an `aspect-ratio: 1/1` box with `--cream-100` placeholder background, `loading="lazy"` below the fold. Tile click opens modal with full description and `/contact?ref=<slug>` link. Empty state: editable intro + "New work coming soon".

**About.** One rich-text block (Tiptap output, sanitized HTML), optional portrait image, editable "Find me at" links array. Empty about renders the intro only.

**Contact.** Editable intro, static form (name/email/message) posting via Server Action, editable list of direct contact methods (Venmo, email, Instagram). Honeypot field `website` (zero-width display: none).

**Trade Show Schedule.** Editable intro. Upcoming list ascending. Past shows collapsed below ("Past shows" toggle). Row fields: name, city, venue, booth, date range, optional URL, optional notes. Empty future: collapses past section entirely and shows a one-line message. All-empty: same one-line message.

**Reviews.** Editable intro. Cards sorted by `display_order` then `created_at desc`. Fields: quote, attribution, optional location, optional source label. Empty: page is hidden from nav.

## 5. Admin panel specs

**Login.** Server Action `loginAction(formData)` hashes the submitted password and `ADMIN_PASSWORD` to fixed-length sha256 buffers, then `crypto.timingSafeEqual`. All failures (wrong length, wrong password, system error) return the same generic error after a uniform 1 second delay. On success, sets cookie `__Host-sejb_admin` (HttpOnly, Secure in production, SameSite=Strict, Path=/, Max-Age=2592000), HMAC-SHA256 over `{kid, issued_at}` with `ADMIN_SESSION_SECRET`. `kid=1` for future rotation. Login route is excluded from the admin-cookie middleware (otherwise unreachable). Rate limit: 5/min/IP, 15-minute lockout after 5 failures (Vercel KV-backed).

**CSRF defense.** SameSite=Strict cookie + Origin header check on every admin mutation (Server Action or route handler). Server Actions already carry an opaque action ID, providing additional CSRF resistance, but the explicit Origin check stays as defense-in-depth.

**Dashboard.** Three big-number tiles: Subscribers (active count), Gallery items, Upcoming shows. Cards below linking to each editor with last-edited timestamps. "View public site" link in the top right.

**Page editors.** One form per section, all sections visible on the page editor screen. Each section card shows: section name, "Visible / Hidden" pill toggle, up/down arrow buttons for reorder, fields. Sticky section index list at the top: "Hero (visible) | Featured (visible) | Studio note (hidden) | Newsletter (visible)". Sticky "You have unsaved changes — Save / Discard" bar appears at the bottom when form is dirty. Navigation away when dirty shows a browser confirm. "View public page" link in the editor header opens in a new tab.

**Rich text.** Tiptap with a 3-button toolbar: Bold, Italic, Link. Paragraph on Enter, line break on Shift+Enter. Output stored as sanitized HTML (DOMPurify on the server). Never shown to Emma as markdown.

**Image upload.** File input → client-side canvas pipeline: read EXIF orientation tag, rotate to upright, downscale to max edge 2400px, re-encode as JPEG quality 0.85. The EXIF strip happens implicitly via re-encode (covers GPS leak from Emma's phone). Preview thumbnail shown before Save. Server side: magic-byte sniff (JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, WebP `RIFF....WEBP`), 10 MB hard cap, extension derived from sniffed type. Upload errors show inline under the button with a "Try again" affordance; form state is preserved.

**Gallery / Shows / Testimonials CRUD.** Card-list view (mobile-friendly stacks, not tables) with add/delete-with-confirm. Detail view with full fields. Delete confirms via typed item name on irreversible rows.

**Subscribers.** Three big-number tiles at top: Active total, Added this week, Unsubscribed this week. Card list below (email + source + subscribed_at + suppress action). CSV export. Manual add form with email validation.

**Campaigns.** Composer fields: subject, preheader, body (Tiptap), audience (default all `active`). "Send test to yourself" button (required before real send). Real Send button opens staged-confirm modal: full rendered preview (with unsubscribe footer + from-address + postal address), recipient count, "I sent a test and it looked right" checkbox, type `SEND` to enable button. Disable real Send until test send has succeeded in this session. After send, route to campaign detail screen with live progress (sent X of Y, failures Z, "Retry failed" button if any).

**Empty states.** Each admin list page: icon + one sentence in Emma's voice + primary "Add your first ..." button.

## 6. Data model

Postgres on Neon. Raw SQL in `db/migrations/` (versioned files), applied via an idempotent migration runner endpoint (see §7).

```sql
-- 0001_init.sql

create table if not exists schema_migrations (
  version    integer primary key,
  applied_at timestamptz not null default now()
);

create table if not exists site_content (
  id          bigserial primary key,
  page        text not null,
  section     text not null,
  data        jsonb not null default '{}'::jsonb,
  enabled     boolean not null default true,
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now(),
  unique (page, section)
);

create table if not exists gallery_items (
  id            bigserial primary key,
  slug          text not null unique,
  title         text not null,
  description   text,
  tag           text not null check (tag in ('ceramics','art','necklaces')),
  image_url     text not null,
  image_alt     text,
  image_width   integer,
  image_height  integer,
  price_note    text,
  display_order integer not null default 0,
  is_featured   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists testimonials (
  id            bigserial primary key,
  quote         text not null,
  attribution   text not null,
  location      text,
  source_label  text,
  display_order integer not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists trade_shows (
  id           bigserial primary key,
  name         text not null,
  city         text,
  venue        text,
  booth        text,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  url          text,
  notes        text,
  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists email_subscribers (
  id                       bigserial primary key,
  email                    text not null unique,
  status                   text not null default 'active'
                           check (status in ('active','unsubscribed','bounced')),
  source                   text,
  unsubscribe_token        text not null unique,
  unsubscribe_token_version integer not null default 1,
  subscribed_at            timestamptz not null default now(),
  unsubscribed_at          timestamptz
);

create table if not exists email_campaigns (
  id                bigserial primary key,
  subject           text not null,
  preheader         text,
  body_html         text not null,
  audience          text not null default 'all_active',
  status            text not null default 'draft'
                    check (status in ('draft','queued','sending','sent','failed','cancelled')),
  total_recipients  integer not null default 0,
  success_count     integer not null default 0,
  failure_count     integer not null default 0,
  heartbeat_at      timestamptz,
  sent_at           timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists email_campaign_recipients (
  id                  bigserial primary key,
  campaign_id         bigint not null references email_campaigns(id) on delete cascade,
  subscriber_id       bigint not null references email_subscribers(id) on delete cascade,
  status              text not null default 'pending'
                      check (status in ('pending','sending','sent','failed','bounced')),
  claimed_at          timestamptz,
  resend_message_id   text,
  error               text,
  sent_at             timestamptz,
  unique (campaign_id, subscriber_id)
);

create table if not exists contact_messages (
  id         bigserial primary key,
  name       text not null,
  email      text not null,
  message    text not null,
  ref        text,
  created_at timestamptz not null default now()
);

-- Created in v1, written to in v1.1 (audit log dashboard deferred)
create table if not exists admin_audit_log (
  id              bigserial primary key,
  event           text not null,
  actor_ip        text,
  user_agent      text,
  payload_summary text,
  at              timestamptz not null default now()
);

-- Created in v1, written to in v1.1 (orphan cleanup deferred)
create table if not exists uploads (
  id             bigserial primary key,
  url            text not null,
  area           text not null,
  referenced_by  text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_gallery_tag_order on gallery_items(tag, display_order);
create index if not exists idx_shows_start on trade_shows(starts_at);
create index if not exists idx_subs_status on email_subscribers(status);
create index if not exists idx_campaign_recipients_campaign on email_campaign_recipients(campaign_id);
create index if not exists idx_campaign_recipients_pending on email_campaign_recipients(campaign_id, status) where status = 'pending';
```

`site_content` rows are typed at the read boundary. `lib/content/schemas.ts` exports `SECTION_SCHEMAS`, a map keyed by `(page, section)` to zod schemas. `parseSection(page, section, row.data)` returns `{ok: true, data} | {ok: false, fallback}` with a sensible empty default. Admin writes use `.parse()` (throw on bad input). Adding a section means adding a schema entry plus a renderer, in that order. Sequential `bigserial` IDs are fine while admin is fully gated; documented in `db/migrations/0001_init.sql` as a comment.

## 7. API surface and rendering

**Public pages are Server Components reading the data layer directly.** No `/api/content`, `/api/gallery`, `/api/shows`, `/api/testimonials` public GET endpoints (the v1 plan had these as a self-fetch loop, which is the wrong App Router pattern). Reads are wrapped in `unstable_cache(fn, key, { tags: [...] })`; admin mutations call `revalidateTag` on affected tags via `lib/cache.ts`.

**Admin mutations use Server Actions** for forms (page editors, CRUD, login). Server Actions integrate naturally with `revalidateTag` and keep validation server-side via the same zod schemas as reads. Route handlers exist only for:
- File upload (multipart): `POST /api/admin/upload`
- Migration runner: `POST /api/admin/migrate?confirm=1` (with `?force=1` for dev re-run)
- Campaign send + drain: `POST /api/admin/campaigns/:id/send`, `POST /api/admin/campaigns/:id/drain`
- Email-triggered URLs: `GET /unsubscribe?token=...` (page), `POST /api/unsubscribe` (form), `POST /api/unsubscribe/one-click` (RFC 8058)
- Public form fetches called from client components only when Server Actions don't fit: subscribe form uses Server Action; contact form uses Server Action.

```
PUBLIC ROUTE HANDLERS
  GET    /api/unsubscribe                  rendered confirmation page (no state change)
  POST   /api/unsubscribe                  body: {token}; sets status, returns success page
  POST   /api/unsubscribe/one-click        RFC 8058; body: List-Unsubscribe=One-Click

PUBLIC SERVER ACTIONS (form-encoded)
  subscribeAction(formData)                {email, source?, website-honeypot}
  contactAction(formData)                  {name, email, message, ref?, website-honeypot}

ADMIN ROUTE HANDLERS (cookie + Origin gated)
  POST   /api/admin/migrate?confirm=1[&force=1]
  POST   /api/admin/upload                 multipart -> {url, width, height}
  POST   /api/admin/campaigns/:id/send     202 -> kicks off drain
  POST   /api/admin/campaigns/:id/drain    one bounded batch then schedules next via waitUntil

ADMIN SERVER ACTIONS (cookie + Origin gated)
  loginAction(formData)
  logoutAction()
  saveSectionAction(page, sectionId, data, enabled, sortOrder)
  galleryUpsertAction / galleryDeleteAction
  showUpsertAction / showDeleteAction
  testimonialUpsertAction / testimonialDeleteAction
  subscriberAddAction / subscriberSuppressAction
  campaignDraftAction / campaignTestSendAction
```

**Database driver.** `@vercel/postgres` (auto-wires to Neon, tagged template parameter binding). `lib/db/index.ts` exports only `sql` (tagged template) and `db.query(text, params)` for dynamic SQL; raw client is not exported. All enum-like inputs (tag, status, audience) validated via zod before reaching SQL.

**Migration runner.** `POST /api/admin/migrate?confirm=1` opens a transaction, takes `pg_advisory_xact_lock(42)`, reads `schema_migrations.version` max, applies each unapplied `db/migrations/000N_*.sql` in order, inserts a row per applied version. Idempotent: re-running on a current database is a no-op. `?force=1` allowed only when `NODE_ENV !== 'production'`.

## 8. Auth flow

1. Emma submits login form. Server Action `loginAction`.
2. Server computes `sha256(input)` and `sha256(ADMIN_PASSWORD)`, calls `crypto.timingSafeEqual(...)` on the two 32-byte buffers. Whole handler wrapped in try/catch with uniform 1s delay; all failures return the same generic error.
3. Vercel KV rate limit: 5/min/IP, lockout after 5 failures for 15 min.
4. On match, sign HMAC-SHA256 over `{kid:1, issued_at}` with `ADMIN_SESSION_SECRET`. Set cookie `__Host-sejb_admin`: HttpOnly, `Secure` if production, SameSite=Strict, Path=/, Max-Age=2592000.
5. `middleware.ts` matcher: `/admin/:path*` and `/api/admin/:path*`, with exclusions for `/admin/login` and `/api/auth/*`. Verifies HMAC, `kid` known, `now - issued_at < Max-Age`. Defense-in-depth `requireAdmin()` helper called at the top of every admin Server Action and route handler.
6. Every admin mutation also checks `request.headers.get('origin')` matches the deployment origin (or `host` header in dev). Mismatch returns 403.

## 9. Image upload flow

1. Admin form `<input type="file">` triggers a client-side canvas pipeline before any network call.
2. Read EXIF orientation tag, rotate canvas to upright. Downscale to max edge 2400px preserving aspect. Re-encode as JPEG quality 0.85 (this implicitly strips EXIF, removing any GPS coords).
3. Show preview thumbnail with "Use this photo / Pick another" affordance.
4. On confirm, multipart POST to `/api/admin/upload`.
5. Server validates: size ≤ 10 MB, magic bytes match JPEG/PNG/WebP (sniffed from first 12 bytes, not from `Content-Type` header). Extension derived from sniffed type. Width/height read from image header.
6. `put('${area}/${ulid()}.${ext}', blob, {access:'public', token: BLOB_READ_WRITE_TOKEN, addRandomSuffix: false})` from `@vercel/blob`.
7. Insert row into `uploads` table: `{url, area, created_at}`. `referenced_by` left null in v1.
8. Return `{url, width, height}` to the form, which stores the URL and dimensions on the relevant entity.
9. Image rendering on public pages uses `next/image` with `images.remotePatterns` allowing `*.public.blob.vercel-storage.com`. `sizes` set per usage: hero `100vw`, gallery tile `(max-width: 768px) 50vw, 33vw`. Vercel's image optimization handles srcset and format negotiation. Intrinsic `width`/`height` from the DB row prevents layout shift.

## 10. Email flow

**Subscribe.** Server Action `subscribeAction` validates email (RFC + length cap), checks honeypot empty, applies rate limit (10/min/IP via KV), then `INSERT ... ON CONFLICT (email) DO NOTHING RETURNING id`. Always generates a 32-byte random `unsubscribe_token` regardless of whether the row inserted (discarded if dupe). Always returns after a fixed minimum elapsed time (250ms) to avoid timing enumeration. Returns `{ok: true}` either way. No double opt-in.

**Subscribe form UI states.** Submitting (button disabled, spinner). Success: form node replaced by single-line "Thanks. A few emails a year, that's it." On 4xx field error: inline under input. On 5xx/network: one-line retry message with email still in field.

**Contact.** Server Action `contactAction` with zod validation: `name` 1-120 chars, `email` RFC + length cap, `message` 1-5000 chars, `ref` matches `^[a-z0-9-]+$` 1-64 chars. Reject any field containing `\r` or `\n`. Honeypot check. Rate limit 5/min/IP. Insert into `contact_messages`. Send Emma an email via Resend's structured `react`/`text` fields (never string-interpolate user content into headers): `to: EMMA_EMAIL`, `reply_to: <validated submitter email>`, subject `"New contact: <name>"`, body renders the submitter's name and message as displayed strings.

**Campaign draft.** Composer Server Action saves draft. Test send is a one-recipient send to a typed-in address that does NOT touch the campaign recipient list.

**Campaign send (fire-and-forget).**
1. POST `/api/admin/campaigns/:id/send` (route handler so we control the HTTP response shape).
2. In a transaction: verify campaign status is `draft` or `failed`; `INSERT INTO email_campaign_recipients (campaign_id, subscriber_id) SELECT :id, id FROM email_subscribers WHERE status='active' ON CONFLICT DO NOTHING`; update campaign status to `queued`, set `total_recipients`, set `heartbeat_at = now()`.
3. Schedule first drain via `waitUntil(fetch('/api/admin/campaigns/:id/drain', {method:'POST', headers:{cookie}}))`. Return 202 `{queued: true, total: N}`.

**Campaign drain.** `POST /api/admin/campaigns/:id/drain` does one bounded batch:
1. Update `heartbeat_at = now()`, set status `sending` if not already.
2. Claim batch: `UPDATE email_campaign_recipients SET status='sending', claimed_at=now() WHERE id IN (SELECT id FROM email_campaign_recipients WHERE campaign_id=:id AND status='pending' LIMIT 25 FOR UPDATE SKIP LOCKED) RETURNING ...`. SKIP LOCKED guards against double-claim if drain runs race.
3. For each claimed recipient, call Resend `emails.send` with idempotency key `<campaign_id>:<recipient_id>`. Set headers: `List-Unsubscribe: <mailto:unsubscribe@studioejb...>, <https://studioejb.vercel.app/api/unsubscribe/one-click?token=...>`, `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Body footer includes studio name, `STUDIO_MAILING_ADDRESS` env var (CAN-SPAM postal address requirement), and the recipient's unsubscribe URL.
4. On Resend success: `UPDATE ... SET status='sent', resend_message_id=:id, sent_at=now()`. On failure: `UPDATE ... SET status='failed', error=:msg`. Update campaign counters.
5. If any `pending` rows remain, schedule next drain via `waitUntil(fetch(...))`. Otherwise mark campaign `sent`, set `sent_at`, clear `heartbeat_at`.

**Stuck campaigns.** A campaign with status `sending` and `heartbeat_at < now() - 5min` is considered stuck. The campaign detail page shows a "Resume" button that hits `/api/admin/campaigns/:id/drain` directly (which will reset `sending` rows with `claimed_at < now() - 5min` back to `pending` before claiming a new batch).

**Unsubscribe.**
- `GET /unsubscribe?token=...` renders a confirmation page with a POST form. No state change on GET (prevents email-scanner prefetch from silently unsubscribing).
- `POST /api/unsubscribe` (form submission) looks up token, sets status `unsubscribed`, stamps `unsubscribed_at`, renders confirmation page.
- `POST /api/unsubscribe/one-click` accepts the RFC 8058 form body, processes immediately. This is the URL referenced from `List-Unsubscribe` header.
- Bulk-invalidate path: bump `unsubscribe_token_version` to invalidate all outstanding tokens at once if needed.

**From address.** Use `hello@studioejb.com` if domain is verifiable on Resend; otherwise use a Resend onboarding sender. Flagged in §15.

## 11. Design system

**Color tokens.**
- `--cream-50: #FAF7F2` page background
- `--cream-100: #F2ECE2` cards, dividers, gallery tile placeholders
- `--ink-900: #2B2620` primary text, focus rings, button borders
- `--ink-600: #5A4F44` secondary text (darkened from v1 to clear 4.5:1 on cream-50)
- `--accent-700: #6F5638` links (darkened from v1 to clear 4.5:1 at body size)

No gradients. One shadow: `0 1px 2px rgba(43,38,32,0.06)` on image cards.

**Type.** Display: Fraunces (400, 600). Body: Inter (400, 500). Scale: 14, 16 (body), 20, 24, 32, 48 (hero). The 12px rung was dropped from v1; if a smaller label is genuinely needed (timestamp, caption), use 13px and only on `--cream-100` cards. Line-height 1.5 body, 1.15 display.

**Spacing.** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px. Multiples only.

**Primitives.** Button (one style, cream-with-ink-border, hover inverts, min 44px tap), Input, Textarea, RichText (Tiptap), Card, Tag (chip), Nav (top bar, mobile slide-down), Footer (two lines), EmptyState (icon + sentence + CTA), DirtyBar (sticky bottom bar with Save/Discard), ImageUploader (with EXIF pipeline). Touch targets: all interactive elements ≥ 44px height.

## 12. Initial seed content

Run during the first `migrate` after table creation. All copy is placeholder; everything obviously a placeholder so Emma replaces it.

- `site_content` rows for every section in §4, populated with placeholder strings and empty arrays/URLs.
- `gallery_items`: 3 rows, one per tag (ceramics / art / necklaces), `cream-100` SVG placeholder image inline (no external dependency).
- `testimonials`: 1 row, "A kind word about Emma's work goes here." attributed to "Placeholder, edit me".
- `trade_shows`: 1 row, name "Coming soon", `starts_at = now() + 30 days`, notes "Edit or delete this in /admin/shows".
- `site_content` row for the campaign-footer template: includes `{{studio_mailing_address}}` and `{{unsubscribe_url}}` placeholders. Send is blocked at the UI level if `STUDIO_MAILING_ADDRESS` env var is unset.

All seed inserts use `ON CONFLICT DO NOTHING` so migration re-runs are safe.

## 13. Acceptance criteria

**Home.** Hero renders with all four fields. Featured hides cleanly when empty. Newsletter signup persists a subscriber and shows the success swap-out. Upcoming show pulls the soonest future row, hides if none.

**Gallery.** Tag filters update URL via `replaceState` and grid. Tile modal shows description and `/contact?ref=<slug>` link. Empty state renders one line. Tiles maintain layout with `aspect-ratio: 1/1` while images load.

**About.** Tiptap-edited rich text renders paragraphs, bold, italic, links. `<script>` is stripped (DOMPurify). Empty about shows intro only.

**Contact.** Form posts via Server Action, inserts `contact_messages`, sends Emma an email through Resend with structured fields, shows the success swap-out. Honeypot triggers silent 200. Submitting `\r\n` in name returns validation error.

**Shows.** Upcoming sorted ascending, past collapsed under toggle. All-empty: one-line message.

**Reviews.** Cards in `display_order`. Empty: page hidden from nav.

**Admin auth.** Wrong password rejected with uniform 1s delay; correct password lands on dashboard; logout clears cookie. 5 wrong attempts in a row locks for 15 min (KV-backed). Each `/admin/*` and `/api/admin/*` route returns 401 or redirects without cookie (manual run-through; no automated test). Cross-origin POST to any admin endpoint is rejected by Origin check.

**Admin editor.** Emma edits hero copy on `/admin/pages/home`, saves, refreshes `/`, sees the change immediately (revalidateTag). Section reorder works via up/down arrows. Toggle pill flips Visible↔Hidden. Sticky dirty bar appears on edit, disappears on save. Navigating away dirty triggers confirm.

**Image upload.** From a phone, uploads a portrait JPEG; client pipeline rotates to upright and downscales; server sniffs magic bytes and stores. Public page renders correctly oriented and sized. Uploading a 12MB or `image/php` masqueraded file fails with visible inline error.

**Newsletter.** CSV export downloads a valid file. Manual add accepts a new email. Subscribe with an already-subscribed email returns the same success state (no enumeration). Unsubscribe link in a real test email: GET renders confirm page, POST sets status. RFC 8058 one-click POST works against `/api/unsubscribe/one-click`.

**Campaign.** Real campaign delivers to two seeded test subscribers. Campaign send returns 202 immediately, drain runs to completion via `waitUntil` recursion. Both unsubscribe links work end to end. Email footer contains `STUDIO_MAILING_ADDRESS` and unsubscribe URL. Send button is disabled until a test send has succeeded in the session. Modal requires typing `SEND` before the real send.

**Cross-cutting.** Lighthouse accessibility >= 95 mobile on all public pages. axe-core run on every public page returns zero contrast errors. First-load JS <= 200 KB per public page. CLS <= 0.1.

## 14. Out of scope for v1

E-commerce, custom domain, multi-user admin, password reset, custom image transforms (rely on `next/image` defaults: srcset and format negotiation come free), image deletion / orphan blob cleanup (uploads table created now, reconciliation in v1.1), drag-and-drop builder, theme switcher, analytics, search, i18n, double opt-in confirmation emails, Resend bounce webhooks (bounces only marked on hard-fail send error), automated test suite (one integration test on campaign send loop deferred to v1.1), admin audit log dashboard (table created, writes deferred), service worker / offline.

## 15. Open questions and risks

- **Domain ownership.** Does Emma own `studioejb.com`? If yes, verify on Resend for `hello@studioejb.com`. If no, use Resend onboarding sender; "via resend.dev" in the From name is unavoidable.
- **STUDIO_MAILING_ADDRESS.** What address does Emma want on campaign footers? PO box, studio, home? CAN-SPAM requires a valid postal address. **Send is blocked at the UI until this env var is set.**
- **EMMA_EMAIL.** Where do contact form submissions and admin notifications go? Likely Emma's personal Gmail.
- **Brand assets.** Logo, or just a Fraunces wordmark? Recommend wordmark only for v1.
- **Trade show data.** Any real 2026 shows to seed? If not, the "Coming soon" placeholder covers it.
- **Reviews provenance.** Real testimonials need attribution permission; placeholders must read as obvious placeholders.
- **Risk: shared password leak.** Rotate by changing `ADMIN_PASSWORD` env var. The `kid` field in the session cookie lets us support graceful overlap later but in v1 a rotation just invalidates the current session.
- **Risk: contact form spam.** Honeypot + 5/min rate limit. Add captcha in v1.1 if spam appears.
- **Risk: orphan blobs.** `uploads` table created now; cleanup logic deferred. Storage cost negligible at this scale.
- **Risk: campaign drain stuck.** Heartbeat + 5-min stuck threshold; Resume button on detail page restarts the drain. If Vercel kills a drain mid-Resend-call, the recipient row stays `sending` with `claimed_at` set; next drain resets `claimed_at < now() - 5min` rows back to `pending`. Worst case: one duplicate email per stuck recipient on resume (acceptable at hobby scale).

## 16. File map

**NEW.**
- `app/layout.tsx`, `app/page.tsx`, page folders: `gallery`, `about`, `contact`, `shows`, `reviews`, `unsubscribe`
- `app/admin/layout.tsx`, `login/page.tsx`, `page.tsx` dashboard, editor folders: `pages/[slug]`, `gallery` (+`[id]`), `shows` (+`[id]`), `testimonials` (+`[id]`), `subscribers`, `campaigns` (+`new` and `[id]`)
- `app/api/admin/upload/route.ts`, `app/api/admin/migrate/route.ts`, `app/api/admin/campaigns/[id]/send/route.ts`, `app/api/admin/campaigns/[id]/drain/route.ts`
- `app/api/unsubscribe/route.ts`, `app/api/unsubscribe/one-click/route.ts`
- `app/actions/auth.ts`, `app/actions/content.ts`, `app/actions/gallery.ts`, `app/actions/shows.ts`, `app/actions/testimonials.ts`, `app/actions/subscribers.ts`, `app/actions/campaigns.ts`, `app/actions/public-forms.ts` (subscribe + contact)
- `middleware.ts`
- `db/migrations/0001_init.sql`, `db/seed.sql`
- `lib/db/index.ts` (sql + db.query helpers), `lib/db/queries.ts` (typed read helpers)
- `lib/auth.ts` (cookie sign/verify, requireAdmin helper, Origin check)
- `lib/email/client.ts` (Resend wrapper), `lib/email/campaigns.ts` (drain + claim logic), `lib/email/templates.ts` (footer + unsubscribe link)
- `lib/content/schemas.ts` (SECTION_SCHEMAS, parseSection)
- `lib/blob.ts` (upload + magic-byte sniff)
- `lib/cache.ts` (revalidateTag helper with tag conventions)
- `lib/ratelimit.ts` (Vercel KV fixed-window)
- `lib/sanitize.ts` (DOMPurify wrapper for Tiptap output)
- `components/` primitives: `Button`, `Input`, `Textarea`, `RichText` (Tiptap), `Card`, `Tag`, `Nav`, `Footer`, `EmptyState`, `DirtyBar`, `ImageUploader` (client-side EXIF pipeline), `SectionEditor`, `SubscribeForm`, `ContactForm`, `CampaignComposer`
- `styles/tokens.css`, `styles/globals.css`
- `public/favicon.svg`, `public/og-default.jpg`
- `.env.local.example`, rewritten `README.md`

**MODIFIED.** `package.json` (drop Vite, add Next 15 + deps), `tsconfig.json` for Next defaults, `vercel.json` (framework `nextjs`), `.gitignore` for `.next` and `.vercel`.

**DELETED.** `src/`, `index.html`, `vite.config.ts`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `dist/`.

## 17. Phases

Each phase is one or two commits inside the single PR. PR is squash-merged. Phases share a build/typecheck gate at the end (each phase must `next build` clean before moving on).

**Phase 0: scaffold.** Delete Vite skeleton. `create-next-app@latest` with App Router, TypeScript, no Tailwind, no eslint-app. Install `@vercel/postgres`, `@vercel/blob`, `@vercel/kv`, `resend`, `zod`, `ulid`, `@tiptap/react`, `@tiptap/starter-kit`, `isomorphic-dompurify`. Write `.env.local.example` listing `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `EMMA_EMAIL`, `STUDIO_MAILING_ADDRESS`. Configure `next.config.js` with `images.remotePatterns` for `*.public.blob.vercel-storage.com`. *Accept:* `next dev` runs, `next build` passes, deploy preview returns 200 on `/`.

**Phase 1: data layer + schemas.** `db/migrations/0001_init.sql`, `lib/db/index.ts`, `lib/db/queries.ts`, `lib/content/schemas.ts` with SECTION_SCHEMAS + parseSection, `/api/admin/migrate` route handler (cookie-gated + advisory lock), seed inserts at end of `0001_init.sql`. *Accept:* migrate endpoint on a fresh Neon DB applies migration, seeds rows, `schema_migrations` has version 1. Re-running migrate is a no-op.

**Phase 2: auth + admin shell.** `lib/auth.ts` (sha256 + timingSafeEqual, sign/verify cookie, requireAdmin helper, Origin check). `middleware.ts` matcher excluding `/admin/login` and `/api/auth`. `lib/ratelimit.ts`. Login Server Action, logout Server Action, `/admin/login`, `/admin` dashboard with stat tiles + last-edited cards. *Accept:* manual run-through of every admin route confirms 401/redirect without cookie. Wrong password rejected with uniform 1s delay. 5 wrong attempts lock for 15 min. Cross-origin POST to any admin endpoint rejected.

**Phase 3: public pages + design system.** All six public pages reading via `lib/db/queries.ts` + `parseSection`. Nav, Footer, design tokens, primitives. `next/image` config for Blob domain. Server Components cached with tags. *Accept:* every page renders with seed content; mobile and desktop layouts hold; axe-core passes; Lighthouse >= 95 on mobile.

**Phase 3.5: revalidation gate.** Edit a `site_content.data` row directly via psql or a temp script while `next dev` is running. Refresh the affected public page, confirm change is visible. This validates the cache tag wiring before the editors are built on top of it. *Accept:* manual psql edit + page refresh shows the change immediately.

**Phase 4: admin editors.** Page editors with section cards (up/down arrows + Visible/Hidden pill + Tiptap rich-text + DirtyBar), gallery/shows/testimonials CRUD with card lists + delete-confirm, image upload route handler + client-side EXIF pipeline. Every save action calls `revalidateTag`. *Accept:* Emma edits hero copy on home, sees it on `/` after refresh. Uploads portrait photo from phone, renders upright. Reorder via arrows changes the public-page order. Tiptap output is sanitized (test with `<script>alert(1)</script>`).

**Phase 5: newsletter + contact.** Subscribe Server Action with honeypot + 250ms timing pad + rate limit. Contact Server Action with strict zod + CRLF rejection. Subscribe form UI states. Subscribers admin page with stat tiles + card list + CSV + manual add + suppress. Unsubscribe public page + form POST + one-click POST. *Accept:* signup persists a row, success swap-out renders. Real unsubscribe email from a test campaign: GET renders confirm page, POST sets status. RFC 8058 one-click POST works via `curl`. Contact form delivers to `EMMA_EMAIL` with structured Resend fields.

**Phase 6: campaigns.** Composer Server Action, test-send Server Action, send route handler (queue + drain kick-off), drain route handler (claim-then-send + `waitUntil` recursion), heartbeat + stuck-detection, campaign detail with live progress. CAN-SPAM footer block reads `STUDIO_MAILING_ADDRESS` env var; UI blocks Send if unset. *Accept:* test campaign delivers to one address. Real campaign with two seeded subscribers: 202 returns in <1s, drain completes asynchronously, both subscribers receive email with correct footer and unsubscribe URL. Each unsubscribe link works (both GET-confirm and RFC 8058 one-click). Send button stays disabled until test send succeeds in session. Modal requires typing `SEND`.

**Phase 7: polish + ship.** Favicon, OG image (cream JPG with Fraunces wordmark), 404 page (same chrome + Emma-voice copy + CTA back to Home + secondary link to Gallery), error boundary with same chrome. README rewrite with one-page "How Emma uses this" guide: login URL, recurring tasks (add gallery item, edit hero, add show, send blast), and "what to do if something looks broken". *Accept:* Lighthouse >= 95 mobile on all public pages, axe-core zero errors, no console errors, README explains login URL and Emma's three most common tasks.
