-- Recordings (mp3 etc.) that follow a song between devices.
-- Private bucket; each user can only touch files under their own folder:
--   guitar-audio/{auth.uid()}/{song_id}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guitar-audio', 'guitar-audio', false, 52428800, array['audio/*'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "guitar-audio: read own" on storage.objects;
create policy "guitar-audio: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'guitar-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "guitar-audio: insert own" on storage.objects;
create policy "guitar-audio: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'guitar-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "guitar-audio: update own" on storage.objects;
create policy "guitar-audio: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'guitar-audio' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'guitar-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "guitar-audio: delete own" on storage.objects;
create policy "guitar-audio: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'guitar-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
