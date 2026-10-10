-- Pictures are JPEG, PNG, or WebP, and at most 1 MB.
-- 0006 already created the bucket. This tightens it on databases that ran that version.

update storage.buckets
set file_size_limit = 1048576,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';
