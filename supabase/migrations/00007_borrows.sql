-- Borrows table
create type public.borrow_status as enum ('requested', 'active', 'returned', 'cancelled');

create table public.borrows (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  borrower_id uuid not null references public.profiles(id) on delete cascade,
  from_shop_id uuid not null references public.shops(id) on delete cascade,
  return_shop_id uuid references public.shops(id) on delete set null,
  status public.borrow_status not null default 'requested',
  due_at timestamptz,
  borrowed_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger borrows_updated_at
  before update on public.borrows
  for each row execute function public.set_updated_at();

create index borrows_item_id_idx on public.borrows(item_id);
create index borrows_borrower_id_idx on public.borrows(borrower_id);

-- RLS
alter table public.borrows enable row level security;

create policy "Borrowers can view their borrows"
  on public.borrows for select
  using (borrower_id = auth.uid());

create policy "Shop members can view borrows for their shops"
  on public.borrows for select
  using (
    exists (
      select 1 from public.shop_members
      where shop_members.shop_id = borrows.from_shop_id
      and shop_members.user_id = auth.uid()
    )
  );

create policy "Shop members can create borrows"
  on public.borrows for insert
  with check (
    exists (
      select 1 from public.shop_members
      where shop_members.shop_id = borrows.from_shop_id
      and shop_members.user_id = auth.uid()
    )
  );

create policy "Involved parties can update borrows"
  on public.borrows for update
  using (
    borrower_id = auth.uid()
    or exists (
      select 1 from public.shop_members
      where shop_members.shop_id = borrows.from_shop_id
      and shop_members.user_id = auth.uid()
      and shop_members.role in ('owner', 'admin')
    )
  );
