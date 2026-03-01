-- Add email column to shop_invites for email-based invitations
ALTER TABLE public.shop_invites ADD COLUMN email text;
