-- Studio EJB 0002_gallery_visibility
-- Per-item toggles so Emma can show only the photo for some pieces.
alter table gallery_items
  add column if not exists show_description boolean not null default true;
alter table gallery_items
  add column if not exists show_price boolean not null default true;
