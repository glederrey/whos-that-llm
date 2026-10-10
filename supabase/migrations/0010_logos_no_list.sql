-- 0008 added logos_read. Public logo URLs do not need it, and it lets clients list the bucket.

drop policy if exists logos_read on storage.objects;
