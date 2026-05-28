-- Studio EJB 0003_uploads_original_filename
-- Track the filename the admin picked so the gallery upsert action can
-- derive a default title from it.
alter table uploads
  add column if not exists original_filename text;
