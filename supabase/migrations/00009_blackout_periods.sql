-- Blackout periods table
create table public.blackout_periods (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  item_id uuid references public.items(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);

create index blackout_periods_shop_id_idx on public.blackout_periods(shop_id);
create index blackout_periods_item_id_idx on public.blackout_periods(item_id);

-- RLS
alter table public.blackout_periods enable row level security;

create policy "Shop members can view blackout periods"
  on public.blackout_periods for select
  using (
    exists (
      select 1 from public.shop_members
      where shop_members.shop_id = blackout_periods.shop_id
      and shop_members.user_id = auth.uid()
    )
  );

create policy "Shop owners/admins can manage blackout periods"
  on public.blackout_periods for insert
  with check (
    exists (
      select 1 from public.shop_members
      where shop_members.shop_id = blackout_periods.shop_id
      and shop_members.user_id = auth.uid()
      and shop_members.role in ('owner', 'admin')
    )
  );

create policy "Shop owners/admins can update blackout periods"
  on public.blackout_periods for update
  using (
    exists (
      select 1 from public.shop_members
      where shop_members.shop_id = blackout_periods.shop_id
      and shop_members.user_id = auth.uid()
      and shop_members.role in ('owner', 'admin')
    )
  );

create policy "Shop owners/admins can delete blackout periods"
  on public.blackout_periods for delete
  using (
    exists (
      select 1 from public.shop_members
      where shop_members.shop_id = blackout_periods.shop_id
      and shop_members.user_id = auth.uid()
      and shop_members.role in ('owner', 'admin')
    )
  );
