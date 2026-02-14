-- SMS sessions table
create table public.sms_sessions (
  id uuid primary key default uuid_generate_v4(),
  phone text unique not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  active_shop_id uuid references public.shops(id) on delete set null,
  last_intent jsonb,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index sms_sessions_phone_idx on public.sms_sessions(phone);
create index sms_sessions_user_id_idx on public.sms_sessions(user_id);

-- RLS: SMS sessions are managed server-side with service role key
alter table public.sms_sessions enable row level security;

-- No client-side policies - all access is through service role
