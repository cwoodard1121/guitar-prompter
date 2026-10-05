-- Read-only share links. A share is a random token pointing at one of your songs.
-- Anyone with the link can read that song through get_shared_song(); nobody
-- (signed in or not) can list shares or read another user's songs directly.

create table if not exists public.guitar_shares (
  token      text        primary key check (token ~ '^[A-Za-z0-9_-]{22}$'),
  owner_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  song_id    text        not null,
  created_at timestamptz not null default now(),
  unique (owner_id, song_id)                    -- one link per song
);

alter table public.guitar_shares enable row level security;
revoke all on public.guitar_shares from anon;
grant select, insert, delete on public.guitar_shares to authenticated;

drop policy if exists "guitar_shares: read own" on public.guitar_shares;
create policy "guitar_shares: read own" on public.guitar_shares
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "guitar_shares: create own" on public.guitar_shares;
create policy "guitar_shares: create own" on public.guitar_shares
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists "guitar_shares: delete own" on public.guitar_shares;
create policy "guitar_shares: delete own" on public.guitar_shares
  for delete to authenticated using (owner_id = (select auth.uid()));

-- The only public way in: one live, non-deleted song by exact token.
-- The recording's settings are stripped (the file itself is never shared).
create or replace function public.get_shared_song(p_token text)
returns table (title text, artist text, data jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.title, s.artist, s.data - 'audio', s.updated_at
  from public.guitar_shares sh
  join public.guitar_songs s on s.owner_id = sh.owner_id and s.id = sh.song_id
  where sh.token = p_token
    and s.deleted_at is null
    and s.data is not null
$$;

revoke all on function public.get_shared_song(text) from public;
grant execute on function public.get_shared_song(text) to anon, authenticated;
