-- Setlists: same shape and rules as guitar_songs (owned per user, RLS, newest-wins sync with tombstones).

create table if not exists public.guitar_setlists (
  owner_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  name       text        not null default '',
  data       jsonb,                          -- the full Setlist document (null once deleted)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (owner_id, id)
);

alter table public.guitar_setlists enable row level security;
revoke all on public.guitar_setlists from anon;
grant select, insert, update, delete on public.guitar_setlists to authenticated;

drop policy if exists "guitar_setlists: read own" on public.guitar_setlists;
create policy "guitar_setlists: read own" on public.guitar_setlists
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "guitar_setlists: insert own" on public.guitar_setlists;
create policy "guitar_setlists: insert own" on public.guitar_setlists
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists "guitar_setlists: update own" on public.guitar_setlists;
create policy "guitar_setlists: update own" on public.guitar_setlists
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "guitar_setlists: delete own" on public.guitar_setlists;
create policy "guitar_setlists: delete own" on public.guitar_setlists
  for delete to authenticated using (owner_id = (select auth.uid()));
