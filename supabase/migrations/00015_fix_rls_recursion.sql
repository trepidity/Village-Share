-- Fix infinite recursion in shop_members RLS policies.
-- All policies that query shop_members (including on shop_members itself)
-- now use SECURITY DEFINER helper functions that bypass RLS.

-- Helper: is the current user a member of this shop?
create or replace function public.is_member_of(p_shop_id uuid)
returns boolean
language sql security definer set search_path = ''
as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = p_shop_id and user_id = (select auth.uid())
  );
$$;

-- Helper: is the current user an admin or owner of this shop?
create or replace function public.is_admin_of(p_shop_id uuid)
returns boolean
language sql security definer set search_path = ''
as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = p_shop_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;

-- Helper: is the current user the owner of this shop?
create or replace function public.is_owner_of(p_shop_id uuid)
returns boolean
language sql security definer set search_path = ''
as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = p_shop_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

-- ========================================
-- Replace shop_members policies
-- ========================================

drop policy if exists "Members can view their shop's members" on public.shop_members;
create policy "Members can view their shop's members"
  on public.shop_members for select
  using (public.is_member_of(shop_id));

drop policy if exists "Shop owners/admins can add members" on public.shop_members;
create policy "Shop owners/admins can add members"
  on public.shop_members for insert
  with check (public.is_admin_of(shop_id));

drop policy if exists "Shop owners can update member roles" on public.shop_members;
create policy "Shop owners can update member roles"
  on public.shop_members for update
  using (public.is_owner_of(shop_id));

drop policy if exists "Shop owners/admins can remove members" on public.shop_members;
create policy "Shop owners/admins can remove members"
  on public.shop_members for delete
  using (public.is_admin_of(shop_id) or user_id = (select auth.uid()));

-- ========================================
-- Replace shops select policy
-- ========================================

drop policy if exists "Anyone can view active shops they are a member of" on public.shops;
create policy "Anyone can view active shops they are a member of"
  on public.shops for select
  using (
    is_active = true
    and (
      owner_id = (select auth.uid())
      or public.is_member_of(id)
    )
  );

-- ========================================
-- Replace shop_invites policies
-- ========================================

drop policy if exists "Shop members can view invites for their shop" on public.shop_invites;
create policy "Shop members can view invites for their shop"
  on public.shop_invites for select
  using (public.is_member_of(shop_id));

drop policy if exists "Shop owners/admins can create invites" on public.shop_invites;
create policy "Shop owners/admins can create invites"
  on public.shop_invites for insert
  with check (public.is_admin_of(shop_id));

drop policy if exists "Shop owners/admins can delete invites" on public.shop_invites;
create policy "Shop owners/admins can delete invites"
  on public.shop_invites for delete
  using (public.is_admin_of(shop_id));
