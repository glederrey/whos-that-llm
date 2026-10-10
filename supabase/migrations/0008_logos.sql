-- Company logos live in their own public bucket, separate from profile pictures.
-- The bucket stays empty here. Rows point at logos/{id}.png.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  1048576,
  array['image/svg+xml', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists logos_read on storage.objects;
create policy logos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'logos');

update public.companies
set logo_path = 'logos/' || id || '.png'
where logo_path = '/logos/' || id || '.svg'
   or logo_path = '/logos/' || id || '.png'
   or logo_path = 'logos/' || id || '.svg';
