-- EchoCollectibles schema

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  color text not null default '#5eead4',
  icon text not null default '📦',
  created_at timestamptz default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  collection_id uuid references collections(id) on delete cascade,
  barcode text,
  title text not null,
  image_url text,
  market_value numeric default 0,
  created_at timestamptz default now()
);

alter table collections enable row level security;
alter table items enable row level security;

create policy "own collections" on collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own items" on items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists items_collection_id_idx on items(collection_id);
create index if not exists items_user_id_idx on items(user_id);
