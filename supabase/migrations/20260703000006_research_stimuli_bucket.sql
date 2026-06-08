-- Public Storage bucket for Market Research stimulus images.
--
-- Mirrors the existing org-branding bucket pattern: public reads are required
-- by participant-facing interview pages, while writes happen only server-side
-- through the service-role client after Clerk org + plan ownership checks.
--
-- Raster-only by design. SVG is excluded because public-bucket SVGs can carry
-- active content. The bucket limits complement, but do not replace, route-side
-- MIME, byte-size, and file-signature validation.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'research-stimuli',
  'research-stimuli',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
