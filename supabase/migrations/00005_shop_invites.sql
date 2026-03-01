-- Enable pgcrypto for gen_random_bytes
create extension if not exists "pgcrypto" with schema "extensions";

-- Shop invites table
create table public.shop_invites (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  phone text,
  token text unique not null default encode(extensions.gen_random_bytes(16), 'hex'),
  role public.shop_role not null default 'member',
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index shop_invites_token_idx on public.shop_invites(token);
create index shop_invites_phone_idx on public.shop_invites(phone);

-- RLS
alter table public.shop_invites enable row level security;

create policy "Shop members can view invites for their shop"
  on public.shop_invites for select
  using (
    exists (
      select 1 from public.shop_members
      where shop_members.shop_id = shop_invites.shop_id
      and shop_members.user_id = auth.uid()
    )
  );

create policy "Shop owners/admins can create invites"
  on public.shop_invites for insert
  with check (
    exists (
      select 1 from public.shop_members
      where shop_members.shop_id = shop_invites.shop_id
      and shop_members.user_id = auth.uid()
      and shop_members.role in ('owner', 'admin')
    )
  );

create policy "Invite token holders can view their invite"
  on public.shop_invites for select
  using (true);

create policy "Shop owners/admins can delete invites"
  on public.shop_invites for delete
  using (
    exists (
      select 1 from public.shop_members
      where shop_members.shop_id = shop_invites.shop_id
      and shop_members.user_id = auth.uid()
      and shop_members.role in ('owner', 'admin')
    )
  );

create policy "Invites can be updated (accepted)"
  on public.shop_invites for update
  using (true)
  with check (true);
