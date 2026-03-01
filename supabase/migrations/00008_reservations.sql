-- Reservations table
create type public.reservation_status as enum ('pending', 'confirmed', 'cancelled', 'fulfilled');

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.reservation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reservations_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

create index reservations_item_id_idx on public.reservations(item_id);
create index reservations_user_id_idx on public.reservations(user_id);

-- RLS
alter table public.reservations enable row level security;

create policy "Users can view their reservations"
  on public.reservations for select
  using (user_id = auth.uid());

create policy "Shop members can view reservations for shop items"
  on public.reservations for select
  using (
    exists (
      select 1 from public.items
      join public.shop_members on shop_members.shop_id = items.shop_id
      where items.id = reservations.item_id
      and shop_members.user_id = auth.uid()
    )
  );

create policy "Shop members can create reservations"
  on public.reservations for insert
  with check (
    exists (
      select 1 from public.items
      join public.shop_members on shop_members.shop_id = items.shop_id
      where items.id = reservations.item_id
      and shop_members.user_id = auth.uid()
    )
  );

create policy "Users can update their own reservations"
  on public.reservations for update
  using (user_id = auth.uid());

create policy "Shop owners/admins can update reservations"
  on public.reservations for update
  using (
    exists (
      select 1 from public.items
      join public.shop_members on shop_members.shop_id = items.shop_id
      where items.id = reservations.item_id
      and shop_members.user_id = auth.uid()
      and shop_members.role in ('owner', 'admin')
    )
  );
