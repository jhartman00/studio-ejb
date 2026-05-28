-- Studio EJB 0001_init
-- Sequential bigserial IDs are intentional for v1: the admin panel is
-- the only writer and is fully cookie-gated. IDOR exposure is bounded
-- by the auth check. Documented in PLAN.md §6.

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
  id                        bigserial primary key,
  email                     text not null unique,
  status                    text not null default 'active'
                            check (status in ('active','unsubscribed','bounced')),
  source                    text,
  unsubscribe_token         text not null unique,
  unsubscribe_token_version integer not null default 1,
  subscribed_at             timestamptz not null default now(),
  unsubscribed_at           timestamptz
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
  id                bigserial primary key,
  campaign_id       bigint not null references email_campaigns(id) on delete cascade,
  subscriber_id     bigint not null references email_subscribers(id) on delete cascade,
  status            text not null default 'pending'
                    check (status in ('pending','sending','sent','failed','bounced')),
  claimed_at        timestamptz,
  resend_message_id text,
  error             text,
  sent_at           timestamptz,
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

-- Created now, writes deferred to v1.1
create table if not exists admin_audit_log (
  id              bigserial primary key,
  event           text not null,
  actor_ip        text,
  user_agent      text,
  payload_summary text,
  at              timestamptz not null default now()
);

-- Created now, orphan cleanup deferred to v1.1
create table if not exists uploads (
  id            bigserial primary key,
  url           text not null,
  area          text not null,
  referenced_by text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_gallery_tag_order
  on gallery_items(tag, display_order);
create index if not exists idx_shows_start
  on trade_shows(starts_at);
create index if not exists idx_subs_status
  on email_subscribers(status);
create index if not exists idx_campaign_recipients_campaign
  on email_campaign_recipients(campaign_id);
create index if not exists idx_campaign_recipients_pending
  on email_campaign_recipients(campaign_id, status)
  where status = 'pending';

-- Seed content. All copy is obviously a placeholder so Emma rewrites it.
-- Re-runs are safe: every insert uses on conflict do nothing.

-- HOME
insert into site_content (page, section, data, enabled, sort_order) values
  ('home', 'hero', jsonb_build_object(
    'headline', 'Placeholder headline, edit me in /admin',
    'subhead', 'A short line about what Studio EJB is. Edit this.',
    'image_url', '',
    'image_alt', '',
    'image_width', null,
    'image_height', null,
    'cta_label', 'See the work',
    'cta_href', '/gallery'
  ), true, 0),
  ('home', 'featured', jsonb_build_object(
    'gallery_item_ids', jsonb_build_array()
  ), true, 1),
  ('home', 'studio_note', jsonb_build_object(
    'title', 'From the studio',
    'body_html', '<p>Placeholder paragraph, edit me. A sentence or two about what is happening in the studio this season.</p>'
  ), true, 2),
  ('home', 'newsletter', jsonb_build_object(
    'title', 'Stay in the loop',
    'body', 'A few emails a year, that is it.'
  ), true, 3)
on conflict (page, section) do nothing;

-- ABOUT
insert into site_content (page, section, data, enabled, sort_order) values
  ('about', 'intro', jsonb_build_object(
    'title', 'About',
    'body_html', '<p>Placeholder, edit me. Two or three paragraphs about Emma, the work, and the studio.</p>',
    'portrait_url', '',
    'portrait_alt', '',
    'portrait_width', null,
    'portrait_height', null
  ), true, 0),
  ('about', 'find_me_at', jsonb_build_object(
    'links', jsonb_build_array(
      jsonb_build_object('label', 'Instagram', 'href', 'https://instagram.com/'),
      jsonb_build_object('label', 'Email', 'href', 'mailto:hello@example.com')
    )
  ), true, 1)
on conflict (page, section) do nothing;

-- CONTACT
insert into site_content (page, section, data, enabled, sort_order) values
  ('contact', 'intro', jsonb_build_object(
    'title', 'Contact',
    'body', 'Placeholder. Say something here about how Emma prefers to be reached.'
  ), true, 0),
  ('contact', 'methods', jsonb_build_object(
    'methods', jsonb_build_array(
      jsonb_build_object('label', 'Venmo', 'value', '@placeholder'),
      jsonb_build_object('label', 'Email', 'value', 'hello@example.com'),
      jsonb_build_object('label', 'Instagram', 'value', '@placeholder')
    )
  ), true, 1)
on conflict (page, section) do nothing;

-- GALLERY
insert into site_content (page, section, data, enabled, sort_order) values
  ('gallery', 'intro', jsonb_build_object(
    'title', 'Gallery',
    'body', 'Placeholder, edit me. A sentence about the work.'
  ), true, 0)
on conflict (page, section) do nothing;

-- SHOWS
insert into site_content (page, section, data, enabled, sort_order) values
  ('shows', 'intro', jsonb_build_object(
    'title', 'Where to find me',
    'body', 'Placeholder, edit me. A line about which shows are coming up.'
  ), true, 0)
on conflict (page, section) do nothing;

-- REVIEWS
insert into site_content (page, section, data, enabled, sort_order) values
  ('reviews', 'intro', jsonb_build_object(
    'title', 'Kind words',
    'body', 'Placeholder, edit me. A line introducing the testimonials.'
  ), true, 0)
on conflict (page, section) do nothing;

-- CAMPAIGN FOOTER TEMPLATE
-- {{studio_mailing_address}} and {{unsubscribe_url}} are substituted at send time.
-- UI blocks Send if STUDIO_MAILING_ADDRESS env var is empty or looks placeholder.
insert into site_content (page, section, data, enabled, sort_order) values
  ('campaign', 'footer_template', jsonb_build_object(
    'body_html',
    '<p style="font-size:13px;color:#5A4F44;margin-top:32px;">' ||
    'Studio EJB. {{studio_mailing_address}}.<br/>' ||
    'You are getting this because you signed up at studioejb.vercel.app. ' ||
    '<a href="{{unsubscribe_url}}">Unsubscribe</a>.' ||
    '</p>'
  ), true, 0)
on conflict (page, section) do nothing;

-- Seed gallery: one row per tag, cream SVG placeholder (data URI inline).
-- Width/height match the SVG viewport.
insert into gallery_items (
  slug, title, description, tag, image_url, image_alt,
  image_width, image_height, price_note, display_order, is_featured
) values
  (
    'placeholder-ceramic-1',
    'Placeholder ceramic',
    'Placeholder description, edit me in /admin/gallery.',
    'ceramics',
    'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 800%22><rect width=%22800%22 height=%22800%22 fill=%22%23F2ECE2%22/><text x=%22400%22 y=%22420%22 fill=%22%235A4F44%22 font-family=%22serif%22 font-size=%2236%22 text-anchor=%22middle%22>placeholder ceramic</text></svg>',
    'Placeholder ceramic image',
    800, 800, 'Edit price note in /admin', 0, true
  ),
  (
    'placeholder-art-1',
    'Placeholder painting',
    'Placeholder description, edit me in /admin/gallery.',
    'art',
    'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 800%22><rect width=%22800%22 height=%22800%22 fill=%22%23F2ECE2%22/><text x=%22400%22 y=%22420%22 fill=%22%235A4F44%22 font-family=%22serif%22 font-size=%2236%22 text-anchor=%22middle%22>placeholder painting</text></svg>',
    'Placeholder painting image',
    800, 800, null, 1, true
  ),
  (
    'placeholder-necklace-1',
    'Placeholder necklace',
    'Placeholder description, edit me in /admin/gallery.',
    'necklaces',
    'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 800%22><rect width=%22800%22 height=%22800%22 fill=%22%23F2ECE2%22/><text x=%22400%22 y=%22420%22 fill=%22%235A4F44%22 font-family=%22serif%22 font-size=%2236%22 text-anchor=%22middle%22>placeholder necklace</text></svg>',
    'Placeholder necklace image',
    800, 800, null, 2, true
  )
on conflict (slug) do nothing;

-- Seed testimonial
insert into testimonials (quote, attribution, location, source_label, display_order, is_published) values
  ('A kind word about Emma''s work goes here.', 'Placeholder, edit me', null, null, 0, true)
on conflict do nothing;

-- Seed trade show (30 days out)
insert into trade_shows (name, city, venue, booth, starts_at, ends_at, url, notes, is_published) values
  ('Coming soon', null, null, null, now() + interval '30 days', now() + interval '32 days', null,
   'Edit or delete this in /admin/shows', true)
on conflict do nothing;
