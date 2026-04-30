-- E4: Approval flow + notifications
-- Adds the `notifications` table. The PO tables (`purchase_orders`,
-- `po_status_history`) are added by E3 in 20260430200100_e3_purchase_orders.sql;
-- this migration runs after thanks to its numeric prefix and only references
-- those tables loosely (no FK is required for notifications.payload).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications(user_id, created_at desc);

create index if not exists notifications_unread_idx
  on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

-- Users SELECT only their own notifications.
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

-- Users UPDATE only their own notifications (intended use: marking read).
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- INSERTs are service-role only — no policy = no INSERT for authenticated users.
-- (Service-role bypasses RLS.)
