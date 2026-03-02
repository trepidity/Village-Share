-- Log unrecognized chat/SMS messages for parser improvement
create table unrecognized_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_message text not null,
  source text not null check (source in ('chat', 'sms')),
  ai_attempted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table unrecognized_messages enable row level security;
-- No policies: only service-role/admin inserts
