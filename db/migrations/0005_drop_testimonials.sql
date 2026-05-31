-- Studio EJB 0005_drop_testimonials
-- Reviews are no longer surfaced on the public site or admin panel.
-- Drop the storage so future schema work does not have to carry it.
drop table if exists testimonials;
