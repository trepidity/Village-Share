-- Migration: Replace per-invite tokens with a single static invite_token on villages.
-- Admins can regenerate the token to invalidate old links.

-- ============================================================
-- 1. Add invite_token column to villages
-- ============================================================

alter table public.villages
  add column invite_token text unique;

-- Backfill existing villages
update public.villages
  set invite_token = encode(extensions.gen_random_bytes(16), 'hex')
  where invite_token is null;

-- Now set NOT NULL + default for new villages
alter table public.villages
  alter column invite_token set not null,
  alter column invite_token set default encode(extensions.gen_random_bytes(16), 'hex');

-- ============================================================
-- 2. Drop village_invites table (policies are dropped automatically)
-- ============================================================

drop table if exists public.village_invites;
