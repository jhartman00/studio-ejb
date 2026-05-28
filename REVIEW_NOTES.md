# Studio EJB Plan v1 — Review Consolidation

Three reviews: security (16 findings), ux (13 findings), architecture (13 findings). Calibration: personal hobby site, one admin, trade-show scale. Folding the load-bearing findings into v2, deferring the rest with explicit reasons.

## Accept and fold into v2

### Security
- **F1 timingSafeEqual** — hash both sides via sha256 before compare, wrap login in try/catch, uniform 1s delay both branches.
- **F2 CSRF** — switch cookie to SameSite=Strict + Origin header check on every admin mutation.
- **F3 Unsubscribe GET prefetch + RFC 8058** — public unsubscribe page is GET (renders confirm button) → POST to mutate. Add `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers + `/api/unsubscribe/one-click` POST endpoint.
- **F4 init-db guard** — write `schema_meta(applied_at)` row in tx, refuse re-run without `?force=1` (dev only). `pg_advisory_xact_lock`. All seeds use `on conflict do nothing`.
- **F6 Contact form** — Resend structured fields only. Zod validation with hard length caps. Reject `\r\n` in name/email.
- **F7 Rate limiting** — Vercel KV based limiter on login (5/min, lockout after 5 fails for 15min), contact (5/min), subscribe (10/min). Honeypot field `website` on contact + subscribe forms.
- **F14 Image upload** — magic-byte sniff (JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, WebP `RIFF....WEBP`). Derive ext from sniffed type, not filename. Strip EXIF (GPS leak from Emma's phone is real).
- **F15 CAN-SPAM postal address** — REQUIRED. Add `STUDIO_MAILING_ADDRESS` env var, render in every campaign footer, block Send if empty. Add to acceptance.

### UX
- **F1 Markdown wrong for Emma** — replace markdown fields with minimal Tiptap WYSIWYG (Bold, Italic, paragraph, link). Plain textarea for fields that don't need formatting. No "markdown" word anywhere in Emma's UI.
- **F2 Drag handles bad on mobile** — replace with explicit up/down arrows + visible "Hidden/Visible" pill. Section index list at top of each page editor. Sticky "unsaved changes" bar.
- **F3 EXIF/orientation/crop** — client-side canvas pass on upload: read EXIF orientation, rotate to upright, downscale to max edge 2400px, re-encode JPEG q0.85. Strip EXIF as side effect (covers F14 too). Aspect-ratio preview before commit.
- **F4 Blast confirmation too light** — staged send modal: rendered preview + recipient count + "I sent a test" checkbox + type `SEND` to enable button. Disable real Send until test send succeeded in session. Live progress page after send begins.
- **F5 Empty states** — spec admin empty states (icon + sentence + primary CTA). Spec public empty states per page. Add to acceptance.
- **F6 Error states** — inline upload errors with retry, sticky save toast keeping form dirty, partial-campaign-failure recovery UI.
- **F8 Cream contrast** — darken `--ink-600` to `#5A4F44`, `--accent-700` to `#6F5638`. Drop 12px from scale except for non-essential labels. Run axe-core check as acceptance gate.
- **F9 Loading states** — `aspect-ratio` boxes on gallery tiles with cream-100 placeholder. `loading="lazy"` below fold. Store `width`/`height` per gallery row.
- **F10 Subscribe feedback** — explicit form states (submitting / success swap-out / error retry). Mirror for contact.

### Architecture
- **F1 Email blast timeout** — fire-and-forget. POST `/api/admin/campaigns/:id/send` inserts recipient rows (single INSERT...SELECT), marks campaign `sending`, kicks off drain via `waitUntil()` + self-recursive `/api/admin/campaigns/:id/drain` (one batch per call, ≤25 recipients, no sleep). Heartbeat column `heartbeat_at` on `email_campaigns`. Resume = "drain stuck campaign" cron-style.
- **F2 Send idempotency** — claim-then-send pattern. Add `claimed_at`, `resend_message_id` columns to `email_campaign_recipients` now.
- **F3 Migration story** — go with option (b): raw SQL + `db/migrations/0001_init.sql` files + `schema_migrations(version, applied_at)` table. ~30 LOC, no ORM. Init endpoint applies unapplied migrations in order.
- **F4 site_content parse-at-boundary** — centralized `lib/content/schemas.ts` with `SECTION_SCHEMAS` map. `parseSection()` returns discriminated union, fallback to empty defaults. All reads + writes go through it.
- **F5 SQL parameterization** — `lib/db/index.ts` exports only `sql` (tagged template) and `db.query(text, params)`. Validate enum-like inputs (tag, status, audience) with zod before SQL.
- **F6 Server Components for public reads** — drop public GET `/api/content`, `/api/gallery`, `/api/shows`, `/api/testimonials`. Server Components import data layer directly. Keep route handlers only for mutations + client fetches + email-triggered URLs.
- **F7 revalidateTag** — `unstable_cache` with tags on every read; every admin mutation calls `revalidateTag` on affected tag(s). `lib/cache.ts` helper.
- **F8 Middleware + Server Actions** — exclude `/admin/login` + `/api/auth/login` from middleware matcher. Use Server Actions for editor saves and CRUD (auto-revalidation); keep route handlers for upload (multipart), init-db, campaign send/drain.
- **F9 next/image config** — `remotePatterns` for `*.public.blob.vercel-storage.com`, `sizes` per usage. Update §14 to clarify "no custom transforms; rely on next/image defaults" (srcset comes free).
- **F10 Uploads table** — add `uploads(id, url, area, created_at, referenced_by)` for v2 cleanup tractability.

## Defer or reject

### Security
- **F5 subscribe enumeration timing** — adopt the cheap mitigation (always generate token, always pad response time to 250ms), accept residual risk. Subscribers list is tiny.
- **F8 session cookie design** — keep 30-day absolute, add `kid` field for future rotation. No idle timeout / nonce / revocation list at this scale.
- **F9 Secure-in-dev / `__Host-` prefix** — accept. `Secure` conditional on production. `__Host-sejb_admin` rename: yes (free).
- **F10 middleware coverage tests** — add the acceptance criterion (manual): "hit each /admin and /api/admin route without cookie, expect 401/redirect". Skip automated test.
- **F11 IDOR / ULID URLs** — DEFER. Sequential bigserial is fine while admin is gated; comment in schema noting it.
- **F13 unsubscribe token signed vs random** — keep random + `version` column for bulk-invalidation. Signed-token rewrite deferred.
- **F16 audit log** — DEFER. Add only the `admin_audit_log` table NOW (3 columns, no writes yet) so v2 can add writes without a migration; the dashboard rendering is v1.1.

### UX
- **F7 filter chip layout** — accept the spec but it's small enough to live in the design system section, not a separate finding.
- **F11 404/error boundary** — accept the spec (same chrome, Emma's voice copy). Already in Phase 7.
- **F12 dashboard tiles instead of tables** — accept. Subscriber stat tiles + card lists on mobile.
- **F13 "View public page" link** — accept. Free.

### Architecture
- **F11 phase ordering** — accept the rewording: move zod schemas into Phase 1, add Phase 3.5 (mutation-then-cache-revalidation check).
- **F12 one integration test** — DEFER. Manual end-to-end test on real Resend with two seeded subscribers is sufficient at this scale. Add as v1.1 todo.
- **F13 lib/ subfolders** — accept. `lib/db/`, `lib/email/`, `lib/content/`, `lib/auth.ts` flat.

## Net delta v1 → v2

- Switch markdown → Tiptap WYSIWYG. Drag → up/down arrows. Save → sticky dirty bar.
- Fire-and-forget email send with drain endpoint + heartbeat. Claim-then-send. RFC 8058 unsubscribe. CAN-SPAM postal address.
- Server Components for public reads, Server Actions for admin writes, drop redundant GET API endpoints.
- Migrations folder + schema_migrations table.
- Tightened palette + axe-core in acceptance.
- Image: client-side EXIF rotate + downscale + magic-byte sniff server-side.
- Admin CSRF: SameSite=Strict + Origin check.
- Auth: sha256-then-timingSafeEqual.
- Uploads table + audit_log table created now, writes deferred.

Total: ~25 changes folded, ~10 explicitly deferred. v2 ships.
