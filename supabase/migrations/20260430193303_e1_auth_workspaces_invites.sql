-- E1: Auth + Workspaces + Invites
-- Tables: workspaces, memberships, invites
-- RLS keyed on workspace_id via auth.user_workspace_ids() helper.

create extension if not exists "citext";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type membership_role as enum ('owner', 'pm', 'bookkeeper');
exception when duplicate_object then null; end $$;

do $$ begin
  create type membership_status as enum ('active', 'invited', 'revoked');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role membership_role not null,
  status membership_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists memberships_user_idx on public.memberships(user_id);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email citext not null,
  role membership_role not null,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invites_workspace_idx on public.invites(workspace_id);

-- ---------------------------------------------------------------------------
-- Helper: current user's active workspace ids
-- ---------------------------------------------------------------------------
create or replace function auth.user_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id
  from public.memberships
  where user_id = auth.uid()
    and status = 'active';
$$;

grant execute on function auth.user_workspace_ids() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;

-- workspaces: members can SELECT their workspace.
drop policy if exists "workspaces_select_members" on public.workspaces;
create policy "workspaces_select_members" on public.workspaces
  for select using (id in (select auth.user_workspace_ids()));

-- memberships: members can SELECT memberships of their workspace.
drop policy if exists "memberships_select_same_ws" on public.memberships;
create policy "memberships_select_same_ws" on public.memberships
  for select using (workspace_id in (select auth.user_workspace_ids()));

-- memberships: only owners can INSERT.
drop policy if exists "memberships_insert_owner" on public.memberships;
create policy "memberships_insert_owner" on public.memberships
  for insert with check (
    exists (
      select 1 from public.memberships m
      where m.workspace_id = memberships.workspace_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
        and m.status = 'active'
    )
  );

-- memberships: only owners can UPDATE.
drop policy if exists "memberships_update_owner" on public.memberships;
create policy "memberships_update_owner" on public.memberships
  for update using (
    exists (
      select 1 from public.memberships m
      where m.workspace_id = memberships.workspace_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
        and m.status = 'active'
    )
  );

-- invites: only owners can SELECT/INSERT for their workspace.
drop policy if exists "invites_select_owner" on public.invites;
create policy "invites_select_owner" on public.invites
  for select using (
    exists (
      select 1 from public.memberships m
      where m.workspace_id = invites.workspace_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
        and m.status = 'active'
    )
  );

drop policy if exists "invites_insert_owner" on public.invites;
create policy "invites_insert_owner" on public.invites
  for insert with check (
    exists (
      select 1 from public.memberships m
      where m.workspace_id = invites.workspace_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
        and m.status = 'active'
    )
  );
