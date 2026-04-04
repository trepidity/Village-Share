-- Prevent multiple active borrows for the same item at the database level.
create unique index if not exists borrows_one_active_per_item_idx
  on public.borrows(item_id)
  where status = 'active';
