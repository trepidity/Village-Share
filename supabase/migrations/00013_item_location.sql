-- Track the physical location of items (which shop they're currently at).
-- Defaults to the home shop (items.shop_id).

alter table public.items
  add column location_shop_id uuid references public.shops(id) on delete set null;

update public.items set location_shop_id = shop_id;

alter table public.items
  alter column location_shop_id set not null;
