-- Notifications table (outbound SMS queue)
create type public.notification_channel as enum ('sms');
create type public.notification_status as enum ('pending', 'sent', 'failed');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel public.notification_channel not null default 'sms',
  status public.notification_status not null default 'pending',
  body text not null,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index notifications_status_scheduled_idx
  on public.notifications(status, scheduled_at)
  where status = 'pending';

-- RLS: Notifications are managed server-side with service role key
alter table public.notifications enable row level security;

-- Users can view their own notifications
create policy "Users can view their own notifications"
  on public.notifications for select
  using (user_id = auth.uid());
