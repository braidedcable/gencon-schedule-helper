create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists picks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  user_name text not null,
  event_id text not null,
  created_at timestamptz default now(),
  unique(group_id, user_name, event_id)
);

-- Allow anyone to read/write (RLS off for simplicity; tighten later)
alter table groups enable row level security;
alter table picks enable row level security;

create policy "public read groups" on groups for select using (true);
create policy "public insert groups" on groups for insert with check (true);

create policy "public read picks" on picks for select using (true);
create policy "public insert picks" on picks for insert with check (true);
create policy "public delete picks" on picks for delete using (true);
