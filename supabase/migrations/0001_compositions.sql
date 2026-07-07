-- Per-user composition storage.
--
-- Each row is one composition owned by a single user. The full Composition
-- object (from src/models/Composition.ts) is stored as JSONB in `data`;
-- `title`/`artist` are duplicated out only to make the home list cheap to query.
-- Row-Level Security guarantees users only ever see/modify their own rows.

create table public.compositions (
  id          text primary key,                     -- reuse the app-generated composition id
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  artist      text,
  data        jsonb not null,                        -- the full Composition object
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.compositions enable row level security;

-- Per-user isolation: a user can only see/modify their own rows.
create policy "own rows - select" on public.compositions
  for select using (auth.uid() = user_id);

create policy "own rows - insert" on public.compositions
  for insert with check (auth.uid() = user_id);

create policy "own rows - update" on public.compositions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows - delete" on public.compositions
  for delete using (auth.uid() = user_id);

create index compositions_user_id_idx on public.compositions (user_id);
