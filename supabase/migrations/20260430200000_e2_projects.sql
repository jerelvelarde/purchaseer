-- E2: Projects + Budget audit
-- Tables: projects, project_budget_history
-- ADR-4: money is bigint centavos; never floats.
-- ADR-6: RLS scoped by workspace_id; route handlers + middleware enforce auth.
-- Reuses auth.user_workspace_ids() from the e1 migration.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type project_status as enum ('active', 'archived');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Helper: current user's role in a given workspace (or null)
-- ---------------------------------------------------------------------------
-- Other epics may reuse this for role-aware RLS predicates.
create or replace function auth.user_role_in(target_workspace_id uuid)
returns membership_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.memberships
  where user_id = auth.uid()
    and workspace_id = target_workspace_id
    and status = 'active'
  limit 1;
$$;

grant execute on function auth.user_role_in(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  budget_centavos bigint not null default 0 check (budget_centavos >= 0),
  assigned_pm_id uuid references auth.users(id) on delete set null,
  status project_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_workspace_idx on public.projects(workspace_id);
create index if not exists projects_assigned_pm_idx on public.projects(assigned_pm_id);

create table if not exists public.project_budget_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  old_centavos bigint not null,
  new_centavos bigint not null,
  actor_id uuid references auth.users(id) on delete set null,
  at timestamptz not null default now()
);

create index if not exists pbh_project_idx on public.project_budget_history(project_id, at desc);

-- ---------------------------------------------------------------------------
-- Trigger: capture every budget change
-- ---------------------------------------------------------------------------
create or replace function public.log_project_budget_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.budget_centavos is distinct from old.budget_centavos then
    insert into public.project_budget_history (
      project_id, old_centavos, new_centavos, actor_id
    ) values (
      new.id, old.budget_centavos, new.budget_centavos, auth.uid()
    );
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_projects_budget_history on public.projects;
create trigger trg_projects_budget_history
  before update on public.projects
  for each row
  execute function public.log_project_budget_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_budget_history enable row level security;

-- projects SELECT:
--   - Owners & bookkeepers: any project in their workspace
--   - PMs: only projects assigned to them
drop policy if exists "projects_select_workspace" on public.projects;
create policy "projects_select_workspace" on public.projects
  for select using (
    workspace_id in (select auth.user_workspace_ids())
    and (
      auth.user_role_in(workspace_id) in ('owner', 'bookkeeper')
      or (auth.user_role_in(workspace_id) = 'pm' and assigned_pm_id = auth.uid())
    )
  );

-- projects INSERT: owners only
drop policy if exists "projects_insert_owner" on public.projects;
create policy "projects_insert_owner" on public.projects
  for insert with check (
    auth.user_role_in(workspace_id) = 'owner'
  );

-- projects UPDATE: owners only (covers edits + archive transitions)
drop policy if exists "projects_update_owner" on public.projects;
create policy "projects_update_owner" on public.projects
  for update using (
    auth.user_role_in(workspace_id) = 'owner'
  ) with check (
    auth.user_role_in(workspace_id) = 'owner'
  );

-- project_budget_history SELECT: anyone who can SELECT the parent project
drop policy if exists "pbh_select_via_project" on public.project_budget_history;
create policy "pbh_select_via_project" on public.project_budget_history
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_budget_history.project_id
        and p.workspace_id in (select auth.user_workspace_ids())
        and (
          auth.user_role_in(p.workspace_id) in ('owner', 'bookkeeper')
          or (auth.user_role_in(p.workspace_id) = 'pm' and p.assigned_pm_id = auth.uid())
        )
    )
  );

-- No INSERT/UPDATE/DELETE policies on project_budget_history:
-- the trigger runs as security definer, so it bypasses RLS for inserts.
-- Direct writes from end-user roles are denied by default.
