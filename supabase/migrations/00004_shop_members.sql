-- Shop members table
create type public.shop_role as enum ('owner', 'admin', 'member');

create table public.shop_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.shop_role not null default 'member',
  created_at timestamptz not null default now(),
  unique(shop_id, user_id)
);

-- Auto-add owner as member when shop is created
create or replace function public.add_owner_as_member()
returns trigger as $$
begin
  insert into public.shop_members (shop_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_shop_created
  after insert on public.shops
  for each row execute function public.add_owner_as_member();

-- RLS
alter table public.shop_members enable row level security;

create policy "Members can view their shop's members"
  on public.shop_members for select
  using (
    exists (
      select 1 from public.shop_members as sm
      where sm.shop_id = shop_members.shop_id
      and sm.user_id = auth.uid()
    )
  );

create policy "Shop owners/admins can add members"
  on public.shop_members for insert
  with check (
    exists (
      select 1 from public.shop_members as sm
      where sm.shop_id = shop_members.shop_id
      and sm.user_id = auth.uid()
      and sm.role in ('owner', 'admin')
    )
  );

create policy "Shop owners can update member roles"
  on public.shop_members for update
  using (
    exists (
      select 1 from public.shop_members as sm
      where sm.shop_id = shop_members.shop_id
      and sm.user_id = auth.uid()
      and sm.role = 'owner'
    )
  );

create policy "Shop owners/admins can remove members"
  on public.shop_members for delete
  using (
    exists (
      select 1 from public.shop_members as sm
      where sm.shop_id = shop_members.shop_id
      and sm.user_id = auth.uid()
      and sm.role in ('owner', 'admin')
    )
    or user_id = auth.uid()
  );

-- Shops select policy (depends on shop_members existing)
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
