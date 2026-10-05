-- Guitar Prompter: songs, owned per user, protected by RLS. No server: the
-- browser talks to Postgres through Supabase and these policies are the API.
-- Single user today; owner_id + RLS means more users would just work.

create table if not exists public.guitar_songs (
  owner_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id             text        not null,
  title          text        not null default '',
  artist         text        not null default '',
  data           jsonb,                          -- the full Song document (null once deleted)
  schema_version int         not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null,           -- set by the client: last edit time, used for newest-wins sync
  deleted_at     timestamptz,                    -- tombstone so a delete reaches the other device
  primary key (owner_id, id)
);

create index if not exists guitar_songs_owner_updated on public.guitar_songs (owner_id, updated_at desc);

alter table public.guitar_songs enable row level security;

-- Only signed-in users, only their own rows.
revoke all on public.guitar_songs from anon;
grant select, insert, update, delete on public.guitar_songs to authenticated;

drop policy if exists "guitar_songs: read own" on public.guitar_songs;
create policy "guitar_songs: read own" on public.guitar_songs
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "guitar_songs: insert own" on public.guitar_songs;
create policy "guitar_songs: insert own" on public.guitar_songs
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists "guitar_songs: update own" on public.guitar_songs;
create policy "guitar_songs: update own" on public.guitar_songs
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "guitar_songs: delete own" on public.guitar_songs;
create policy "guitar_songs: delete own" on public.guitar_songs
  for delete to authenticated using (owner_id = (select auth.uid()));
