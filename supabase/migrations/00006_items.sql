-- Items table
create type public.item_status as enum ('available', 'borrowed', 'unavailable');

create table public.items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  description text,
  category text,
  photo_url text,
  status public.item_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- Trigram index for fuzzy search
create index items_name_trgm_idx on public.items using gin (name gin_trgm_ops);
create index items_shop_id_idx on public.items(shop_id);

-- RLS
alter table public.items enable row level security;

create policy "Shop members can view items"
  on public.items for select
  using (
    exists (
      select 1 from public.shop_members
      where shop_members.shop_id = items.shop_id
      and shop_members.user_id = auth.uid()
    )
  );

create policy "Shop owners/admins can create items"
  on public.items for insert
  with check (
    exists (
      select 1 from public.shop_members
      where shop_members.shop_id = items.shop_id
      and shop_members.user_id = auth.uid()
      and shop_members.role in ('owner', 'admin')
    )
  );

create policy "Shop owners/admins can update items"
  on public.items for update
  using (
    exists (
      select 1 from public.shop_members
      where shop_members.shop_id = items.shop_id
      and shop_members.user_id = auth.uid()
      and shop_members.role in ('owner', 'admin')
    )
  );

create policy "Shop owners/admins can delete items"
  on public.items for delete
  using (
    exists (
      select 1 from public.shop_members
      where shop_members.shop_id = items.shop_id
      and shop_members.user_id = auth.uid()
      and shop_members.role in ('owner', 'admin')
    )
  );
