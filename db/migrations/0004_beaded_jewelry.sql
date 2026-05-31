-- Studio EJB 0004_beaded_jewelry
-- Rename the 'necklaces' tag to 'beaded_jewelry' so the gallery filter
-- can read "Beaded Jewelry" in the UI without forcing future copy changes
-- through a code rename. Idempotent: safe to re-run.

alter table gallery_items
  drop constraint if exists gallery_items_tag_check;

update gallery_items
  set tag = 'beaded_jewelry'
  where tag = 'necklaces';

alter table gallery_items
  add constraint gallery_items_tag_check
  check (tag in ('ceramics', 'art', 'beaded_jewelry'));
