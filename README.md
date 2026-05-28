# Studio EJB

Emma's personal art and ceramics site. Public at https://studioejb.vercel.app.

This is a Next.js 15 App Router app deployed on Vercel. Postgres (Neon),
Blob storage, Resend for email. Single shared-password admin.

## For Emma: how to use this site

### Logging in

1. Open https://studioejb.vercel.app/admin/login on your phone or laptop.
2. Type the password Jamie gave you. The screen waits a beat on every
   attempt, so a small delay is normal.
3. You land on the dashboard. Use that as your starting point.

### Your three most common tasks

**Add a gallery piece.**

1. Dashboard → Gallery items → Add gallery item.
2. Choose a photo from your phone. The site rotates and resizes it for you.
3. Fill in the title and a short description.
4. Pick the category (ceramics / art / necklaces).
5. Optional: tick "Feature on home page" if it's a hero piece.
6. Save.

**Edit the home page hero.**

1. Dashboard → Home.
2. Find the "Hero" card. Edit the headline, subhead, button label, or image.
3. The "Save" bar will slide up at the bottom when you change anything.
4. Tap Save.
5. Open the public site in another tab to verify.

**Add an upcoming show.**

1. Dashboard → Trade shows → Add show.
2. Fill in name, dates, location.
3. Save. It will appear under "Upcoming" on /shows automatically, and the
   soonest one shows up on the home page as "Next show".

### If something looks broken

- Refresh the page first.
- If a "Site is having a moment" screen appears, tap "Try again."
- If the home page is stuck on a placeholder you already changed, wait a
  minute and refresh. The site caches edits for a few seconds.
- If you cannot log in, text Jamie. The password may have been rotated.

### What this site cannot do (yet)

No e-commerce, no calendar sync, no automatic backups. Sales still happen
via Venmo and trade shows.

---

## For Jamie: development

### Stack

- Next.js 15 App Router, TypeScript, React 19
- `@vercel/postgres` against a Neon database
- `@vercel/blob` for image hosting
- `resend` for transactional and bulk email
- Tiptap for rich text, isomorphic-dompurify for sanitizing
- Plain CSS variables in `styles/tokens.css` and `styles/globals.css`

### Local

```bash
cp .env.local.example .env.local
# Pull the values from Vercel project "studio-ejb" / scope jamie-7174s-projects.
vercel env pull
npm install
npm run dev
```

### Run the migration

After `vercel env pull` and `npm run dev`, sign in to /admin and POST:

```bash
curl -X POST -b 'sejb_admin_dev=<cookie value>' \
  "http://localhost:3000/api/admin/migrate?confirm=1"
```

Re-runs are a no-op. Add `&force=1` in dev to replay an applied migration.

### Project layout

- `app/(public)` — public pages: home, gallery, about, contact, shows,
  reviews, unsubscribe, plus not-found and error boundaries.
- `app/(admin-auth)` — authenticated admin pages: dashboard, page editors,
  gallery / shows / testimonials CRUD, subscribers, campaigns.
- `app/admin/login` — login page, outside the admin route group so it skips
  the admin chrome.
- `app/api/admin/*` — admin route handlers: upload, migrate, campaign
  send/drain, CSV export.
- `app/api/unsubscribe/*` — public unsubscribe (GET-confirm-then-POST and
  RFC 8058 one-click).
- `app/actions/*` — Server Actions for forms.
- `components/*` — primitives shared by both public and admin.
- `lib/db/*` — `sql` tagged template and typed read helpers wrapped in
  `unstable_cache` with tags.
- `lib/content/schemas.ts` — `SECTION_SCHEMAS` map. Adding a section means
  adding a schema, then a renderer.
- `lib/cache.ts` — tag conventions and bumpX helpers for `revalidateTag`.
- `lib/auth.ts` / `lib/auth-constants.ts` — cookie sign/verify (HMAC), the
  `requireAdmin` helper, the origin check.
- `lib/ratelimit.ts` — Vercel KV-backed limiter with in-memory fallback.
- `lib/blob.ts` — magic-byte sniff + Vercel Blob upload + uploads row.
- `lib/email/*` — Resend wrapper, footer templates, drain logic.
- `db/migrations/0001_init.sql` — schema plus idempotent seed inserts.
- `middleware.ts` — Edge auth gate (presence + shape, full HMAC in Node).

### Required env vars

See `.env.local.example`. The ones that matter at runtime:

- `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`
- `POSTGRES_URL` (and friends, auto-injected by the Neon integration)
- `BLOB_READ_WRITE_TOKEN` (auto-injected)
- `RESEND_API_KEY`, `RESEND_FROM`
- `EMMA_EMAIL`
- `STUDIO_MAILING_ADDRESS` — must be a real address; campaign send refuses
  to run if this is missing or looks like a placeholder.
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — optional. Without them, rate
  limiting falls back to an in-memory map (fine for hobby scale).

### How email sending works

1. Composer saves a draft via `campaignDraftAction`.
2. "Send test" calls `campaignTestSendAction` (one recipient, doesn't
   touch the campaign recipient list).
3. "Send for real" POSTs to `/api/admin/campaigns/:id/send`. That route:
   - Refuses if `STUDIO_MAILING_ADDRESS` or `RESEND_API_KEY` are missing.
   - In a tx, inserts one row per active subscriber into
     `email_campaign_recipients`, marks the campaign `queued`.
   - Returns 202 and kicks off the first drain via `waitUntil(fetch(...))`.
4. `/api/admin/campaigns/:id/drain` claims up to 25 pending rows with
   `FOR UPDATE SKIP LOCKED`, sends each, updates counters, and either
   marks the campaign `sent` or schedules itself again via `waitUntil`.
5. Stuck rows (>5 min in `sending`) are reset to `pending` on the next
   drain. The detail page has a Resume button that hits the drain
   endpoint directly.

Every campaign email includes a CAN-SPAM-compliant footer with the
studio's postal address and a working unsubscribe URL. List-Unsubscribe
+ List-Unsubscribe-Post headers point at the RFC 8058 one-click endpoint.

### Cache tags

Reads in `lib/db/queries.ts` are wrapped in `unstable_cache` with tags from
`lib/cache.ts`. Admin mutations call the matching `bumpX()` after the SQL
commit, which invalidates the public page on the next render.

Manual verify (Phase 3.5):
```
curl -X POST -b 'sejb_admin_dev=...' \
  'http://localhost:3000/api/admin/_dev/bump-cache?tag=site_content:home'
```

### Deployment

Auto-deployed by Vercel on push to `main`. Preview deploys on every PR.

### What's out of scope for v1

E-commerce, custom domain, multi-user admin, OAuth, image deletion / orphan
blob cleanup (uploads table is created but never reconciled in v1),
analytics, search, i18n, double opt-in, bounce webhooks, automated tests.
Documented in PLAN.md §14.
