-- Migration: Introduce Villages as top-level organizational unit.
-- Villages own shops. Membership is at the village level.
-- Invites target villages and are purely token-based.

-- ============================================================
-- 1. Create village_role enum and new tables
-- ============================================================

create type public.village_role as enum ('owner', 'admin', 'member');

create table public.villages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger villages_updated_at
  before update on public.villages
  for each row execute function public.set_updated_at();

create table public.village_members (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references public.villages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.village_role not null default 'member',
  created_at timestamptz not null default now(),
  unique(village_id, user_id)
);

create table public.village_invites (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references public.villages(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  token text unique not null default encode(extensions.gen_random_bytes(16), 'hex'),
  role public.village_role not null default 'member',
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index village_invites_token_idx on public.village_invites(token);

-- ============================================================
-- 2. Add village_id to shops (nullable initially for migration)
-- ============================================================

alter table public.shops add column village_id uuid references public.villages(id) on delete cascade;

-- ============================================================
-- 3. Data migration: create villages from existing shop owners
-- ============================================================

do $$
declare
  r record;
  v_village_id uuid;
  m record;
begin
  for r in select distinct owner_id from public.shops loop
    -- Create a village per shop owner
    insert into public.villages (name, created_by)
    select coalesce(p.display_name, 'My') || '''s Village', r.owner_id
    from public.profiles p
    where p.id = r.owner_id
    returning id into v_village_id;

    -- Assign all shops of this owner to the new village
    update public.shops set village_id = v_village_id where owner_id = r.owner_id;

    -- Migrate shop_members into village_members (deduplicate, keep highest role)
    for m in
      select distinct on (user_id) user_id, role
      from public.shop_members
      where shop_id in (select id from public.shops where owner_id = r.owner_id)
      order by user_id,
        case role when 'owner' then 1 when 'admin' then 2 when 'member' then 3 end
    loop
      insert into public.village_members (village_id, user_id, role)
      values (v_village_id, m.user_id, m.role::text::public.village_role)
      on conflict (village_id, user_id) do nothing;
    end loop;
  end loop;
end;
$$;

-- ============================================================
-- 4. Make village_id NOT NULL now that data is migrated
-- ============================================================

alter table public.shops alter column village_id set not null;

-- ============================================================
-- 5. Auto-add village creator as owner
-- ============================================================

create or replace function public.add_village_creator_as_owner()
returns trigger as $$
begin
  insert into public.village_members (village_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_village_created
  after insert on public.villages
  for each row execute function public.add_village_creator_as_owner();

-- ============================================================
-- 6. New RLS helper functions (SECURITY DEFINER, bypass RLS)
-- ============================================================

create or replace function public.is_village_member(p_village_id uuid)
returns boolean
language sql security definer set search_path = ''
as $$
  select exists (
    select 1 from public.village_members
    where village_id = p_village_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_village_admin(p_village_id uuid)
returns boolean
language sql security definer set search_path = ''
as $$
  select exists (
    select 1 from public.village_members
    where village_id = p_village_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_village_owner(p_village_id uuid)
returns boolean
language sql security definer set search_path = ''
as $$
  select exists (
    select 1 from public.village_members
    where village_id = p_village_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

create or replace function public.is_village_member_via_shop(p_shop_id uuid)
returns boolean
language sql security definer set search_path = ''
as $$
  select exists (
    select 1 from public.shops s
    join public.village_members vm on vm.village_id = s.village_id
    where s.id = p_shop_id and vm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_village_admin_via_shop(p_shop_id uuid)
returns boolean
language sql security definer set search_path = ''
as $$
  select exists (
    select 1 from public.shops s
    join public.village_members vm on vm.village_id = s.village_id
    where s.id = p_shop_id
      and vm.user_id = (select auth.uid())
      and vm.role in ('owner', 'admin')
  );
$$;

-- ============================================================
-- 7. RLS on new tables
-- ============================================================

alter table public.villages enable row level security;
alter table public.village_members enable row level security;
alter table public.village_invites enable row level security;

-- villages
create policy "Village members can view their villages"
  on public.villages for select
  using (public.is_village_member(id));

create policy "Authenticated users can create villages"
  on public.villages for insert
  with check ((select auth.uid()) = created_by);

create policy "Village owners can update their villages"
  on public.villages for update
  using (public.is_village_owner(id));

create policy "Village owners can delete their villages"
  on public.villages for delete
  using (public.is_village_owner(id));

-- village_members
create policy "Village members can view members"
  on public.village_members for select
  using (public.is_village_member(village_id));

create policy "Village admins can add members"
  on public.village_members for insert
  with check (public.is_village_admin(village_id));

create policy "Village owners can update member roles"
  on public.village_members for update
  using (public.is_village_owner(village_id));

create policy "Village admins can remove members"
  on public.village_members for delete
  using (public.is_village_admin(village_id) or user_id = (select auth.uid()));

-- village_invites
create policy "Village members can view invites"
  on public.village_invites for select
  using (public.is_village_member(village_id));

create policy "Anyone can view invites by token"
  on public.village_invites for select
  using (true);

create policy "Village admins can create invites"
  on public.village_invites for insert
  with check (public.is_village_admin(village_id));

create policy "Village admins can delete invites"
  on public.village_invites for delete
  using (public.is_village_admin(village_id));

create policy "Invites can be accepted"
  on public.village_invites for update
  using (true)
  with check (true);

-- ============================================================
-- 8. Replace RLS policies on existing tables
-- ============================================================

-- --- shops ---
drop policy if exists "Anyone can view active shops they are a member of" on public.shops;
create policy "Village members can view active shops"
  on public.shops for select
  using (is_active = true and public.is_village_member(village_id));

drop policy if exists "Authenticated users can create shops" on public.shops;
create policy "Village members can create shops"
  on public.shops for insert
  with check ((select auth.uid()) = owner_id and public.is_village_member(village_id));

-- Shop owner update/delete policies unchanged (from 00003)

-- --- items ---
drop policy if exists "Shop members can view items" on public.items;
create policy "Village members can view items"
  on public.items for select
  using (public.is_village_member_via_shop(shop_id));

drop policy if exists "Shop owners/admins can create items" on public.items;
create policy "Shop owners can create items"
  on public.items for insert
  with check (
    exists (
      select 1 from public.shops
      where shops.id = items.shop_id and shops.owner_id = (select auth.uid())
    )
    or public.is_village_admin_via_shop(shop_id)
  );

drop policy if exists "Shop owners/admins can update items" on public.items;
create policy "Shop owners can update items"
  on public.items for update
  using (
    exists (
      select 1 from public.shops
      where shops.id = items.shop_id and shops.owner_id = (select auth.uid())
    )
    or public.is_village_admin_via_shop(shop_id)
  );

drop policy if exists "Shop owners/admins can delete items" on public.items;
create policy "Shop owners can delete items"
  on public.items for delete
  using (
    exists (
      select 1 from public.shops
      where shops.id = items.shop_id and shops.owner_id = (select auth.uid())
    )
    or public.is_village_admin_via_shop(shop_id)
  );

-- --- borrows ---
drop policy if exists "Shop members can view borrows for their shops" on public.borrows;
create policy "Village members can view borrows for their shops"
  on public.borrows for select
  using (public.is_village_member_via_shop(from_shop_id));

drop policy if exists "Shop members can create borrows" on public.borrows;
create policy "Village members can create borrows"
  on public.borrows for insert
  with check (public.is_village_member_via_shop(from_shop_id));

drop policy if exists "Involved parties can update borrows" on public.borrows;
create policy "Involved parties can update borrows"
  on public.borrows for update
  using (
    borrower_id = (select auth.uid())
    or exists (
      select 1 from public.shops
      where shops.id = borrows.from_shop_id and shops.owner_id = (select auth.uid())
    )
    or public.is_village_admin_via_shop(from_shop_id)
  );

-- --- reservations ---
drop policy if exists "Shop members can view reservations for shop items" on public.reservations;
create policy "Village members can view reservations for shop items"
  on public.reservations for select
  using (
    exists (
      select 1 from public.items
      where items.id = reservations.item_id
      and public.is_village_member_via_shop(items.shop_id)
    )
  );

drop policy if exists "Shop members can create reservations" on public.reservations;
create policy "Village members can create reservations"
  on public.reservations for insert
  with check (
    exists (
      select 1 from public.items
      where items.id = reservations.item_id
      and public.is_village_member_via_shop(items.shop_id)
    )
  );

drop policy if exists "Shop owners/admins can update reservations" on public.reservations;
create policy "Shop owners can update reservations"
  on public.reservations for update
  using (
    exists (
      select 1 from public.items
      join public.shops on shops.id = items.shop_id
      where items.id = reservations.item_id
      and (
        shops.owner_id = (select auth.uid())
        or public.is_village_admin_via_shop(items.shop_id)
      )
    )
  );

-- --- blackout_periods ---
drop policy if exists "Shop members can view blackout periods" on public.blackout_periods;
create policy "Village members can view blackout periods"
  on public.blackout_periods for select
  using (public.is_village_member_via_shop(shop_id));

drop policy if exists "Shop owners/admins can manage blackout periods" on public.blackout_periods;
create policy "Shop owners can manage blackout periods"
  on public.blackout_periods for insert
  with check (
    exists (
      select 1 from public.shops
      where shops.id = blackout_periods.shop_id and shops.owner_id = (select auth.uid())
    )
    or public.is_village_admin_via_shop(shop_id)
  );

drop policy if exists "Shop owners/admins can update blackout periods" on public.blackout_periods;
create policy "Shop owners can update blackout periods"
  on public.blackout_periods for update
  using (
    exists (
      select 1 from public.shops
      where shops.id = blackout_periods.shop_id and shops.owner_id = (select auth.uid())
    )
    or public.is_village_admin_via_shop(shop_id)
  );

drop policy if exists "Shop owners/admins can delete blackout periods" on public.blackout_periods;
create policy "Shop owners can delete blackout periods"
  on public.blackout_periods for delete
  using (
    exists (
      select 1 from public.shops
      where shops.id = blackout_periods.shop_id and shops.owner_id = (select auth.uid())
    )
    or public.is_village_admin_via_shop(shop_id)
  );

-- ============================================================
-- 9. Drop old tables, triggers, functions, and enum
-- ============================================================

-- Remove the old shop-created trigger (inserts into shop_members)
drop trigger if exists on_shop_created on public.shops;

-- Drop old tables (their RLS policies are dropped automatically)
drop table if exists public.shop_invites;
drop table if exists public.shop_members;

-- Drop old helper functions
drop function if exists public.add_owner_as_member();
drop function if exists public.is_member_of(uuid);
drop function if exists public.is_admin_of(uuid);
drop function if exists public.is_owner_of(uuid);

-- Drop old enum
drop type if exists public.shop_role;
