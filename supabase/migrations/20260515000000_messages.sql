create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  user_name text not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz default now()
);

alter table messages enable row level security;
create policy "public read messages"   on messages for select using (true);
create policy "public insert messages" on messages for insert with check (true);

alter publication supabase_realtime add table messages;
