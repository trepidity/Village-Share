-- Shops table
create table public.shops (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger shops_updated_at
  before update on public.shops
  for each row execute function public.set_updated_at();

-- RLS
alter table public.shops enable row level security;

create policy "Anyone can view active shops they are a member of"
  on public.shops for select
  using (
    is_active = true
    and (
      owner_id = auth.uid()
      or exists (
        select 1 from public.shop_members
        where shop_members.shop_id = shops.id
        and shop_members.user_id = auth.uid()
      )
    )
  );

create policy "Authenticated users can create shops"
  on public.shops for insert
  with check (auth.uid() = owner_id);

create policy "Shop owners can update their shops"
  on public.shops for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Shop owners can delete their shops"
  on public.shops for delete
  using (auth.uid() = owner_id);
