-- E3: Purchase Orders + line items + attachments + status history
-- ADR-4: money stored in centavos (bigint).
-- ADR-5: per-workspace PO sequence reserved at submit.
-- ADR-6: RLS scoped via auth.user_workspace_ids() (defined in e1).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type po_status as enum ('draft', 'pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  po_number text,
  supplier_name text not null,
  total_centavos bigint not null default 0,
  note text,
  status po_status not null default 'draft',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_note text,
  unique (workspace_id, po_number)
);

create index if not exists purchase_orders_workspace_idx on public.purchase_orders(workspace_id);
create index if not exists purchase_orders_project_idx on public.purchase_orders(project_id);
create index if not exists purchase_orders_created_by_idx on public.purchase_orders(created_by);
create index if not exists purchase_orders_status_idx on public.purchase_orders(status);

create table if not exists public.po_line_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  description text not null,
  qty numeric(14, 3) not null check (qty >= 0),
  unit_price_centavos bigint not null check (unit_price_centavos >= 0),
  line_total_centavos bigint not null check (line_total_centavos >= 0),
  created_at timestamptz not null default now()
);

create index if not exists po_line_items_po_idx on public.po_line_items(po_id);

create table if not exists public.po_attachments (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists po_attachments_po_idx on public.po_attachments(po_id);

create table if not exists public.po_status_history (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  from_status po_status,
  to_status po_status not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  note text,
  at timestamptz not null default now()
);

create index if not exists po_status_history_po_idx on public.po_status_history(po_id);

-- ---------------------------------------------------------------------------
-- Per-workspace PO counter (ADR-5)
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_po_counters (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  last_number bigint not null default 0
);

create or replace function public.next_po_number(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  insert into public.workspace_po_counters (workspace_id, last_number)
  values (p_workspace_id, 1)
  on conflict (workspace_id)
    do update set last_number = public.workspace_po_counters.last_number + 1
  returning last_number into n;

  return 'PO-' || lpad(n::text, 3, '0');
end;
$$;

revoke all on function public.next_po_number(uuid) from public;
grant execute on function public.next_po_number(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.purchase_orders enable row level security;
alter table public.po_line_items enable row level security;
alter table public.po_attachments enable row level security;
alter table public.po_status_history enable row level security;
alter table public.workspace_po_counters enable row level security;

-- Helper: is current user owner of given workspace?
create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
      and m.status = 'active'
  );
$$;

grant execute on function public.is_workspace_owner(uuid) to authenticated;

-- purchase_orders SELECT:
--   * owners: any PO in their workspace
--   * other members (pm/bookkeeper): only POs they created
--   (project-assignment scoping is a future refinement; for sprint-01 keep
--    rules simple — PMs see their own, owners see all.)
drop policy if exists "po_select" on public.purchase_orders;
create policy "po_select" on public.purchase_orders
  for select using (
    workspace_id in (select auth.user_workspace_ids())
    and (
      public.is_workspace_owner(workspace_id)
      or created_by = auth.uid()
    )
  );

-- INSERT: must be a member of the workspace, must be pm or owner, draft only,
-- created_by must be self.
drop policy if exists "po_insert_pm" on public.purchase_orders;
create policy "po_insert_pm" on public.purchase_orders
  for insert with check (
    workspace_id in (select auth.user_workspace_ids())
    and created_by = auth.uid()
    and status = 'draft'
    and exists (
      select 1 from public.memberships m
      where m.workspace_id = purchase_orders.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('pm', 'owner')
        and m.status = 'active'
    )
  );

-- UPDATE: PM owner of a draft can update; owner of workspace can update
-- (e.g. for approve/reject in issue #5).
drop policy if exists "po_update" on public.purchase_orders;
create policy "po_update" on public.purchase_orders
  for update using (
    workspace_id in (select auth.user_workspace_ids())
    and (
      public.is_workspace_owner(workspace_id)
      or (created_by = auth.uid() and status = 'draft')
    )
  );

-- po_line_items: scoped via parent PO.
drop policy if exists "poli_select" on public.po_line_items;
create policy "poli_select" on public.po_line_items
  for select using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = po_line_items.po_id
        and po.workspace_id in (select auth.user_workspace_ids())
        and (public.is_workspace_owner(po.workspace_id) or po.created_by = auth.uid())
    )
  );

drop policy if exists "poli_write_owner_draft" on public.po_line_items;
create policy "poli_write_owner_draft" on public.po_line_items
  for all using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = po_line_items.po_id
        and po.created_by = auth.uid()
        and po.status = 'draft'
    )
  ) with check (
    exists (
      select 1 from public.purchase_orders po
      where po.id = po_line_items.po_id
        and po.created_by = auth.uid()
        and po.status = 'draft'
    )
  );

-- po_attachments: select scoped via parent PO; insert by creator on draft.
drop policy if exists "poa_select" on public.po_attachments;
create policy "poa_select" on public.po_attachments
  for select using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = po_attachments.po_id
        and po.workspace_id in (select auth.user_workspace_ids())
        and (public.is_workspace_owner(po.workspace_id) or po.created_by = auth.uid())
    )
  );

drop policy if exists "poa_insert_owner_draft" on public.po_attachments;
create policy "poa_insert_owner_draft" on public.po_attachments
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.purchase_orders po
      where po.id = po_attachments.po_id
        and po.created_by = auth.uid()
        and po.status = 'draft'
    )
  );

drop policy if exists "poa_delete_owner_draft" on public.po_attachments;
create policy "poa_delete_owner_draft" on public.po_attachments
  for delete using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = po_attachments.po_id
        and po.created_by = auth.uid()
        and po.status = 'draft'
    )
  );

-- po_status_history: select scoped via parent PO; inserts go through
-- service-role / route handlers (no insert policy = denied for anon/auth).
drop policy if exists "posh_select" on public.po_status_history;
create policy "posh_select" on public.po_status_history
  for select using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = po_status_history.po_id
        and po.workspace_id in (select auth.user_workspace_ids())
        and (public.is_workspace_owner(po.workspace_id) or po.created_by = auth.uid())
    )
  );

-- workspace_po_counters: no direct access; use next_po_number().

-- ---------------------------------------------------------------------------
-- Storage bucket for PO attachments
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('po-attachments', 'po-attachments', false)
on conflict (id) do nothing;

-- Path layout: <workspace_id>/<po_id>/<filename>
-- Read: any workspace member.
drop policy if exists "po_attachments_read" on storage.objects;
create policy "po_attachments_read" on storage.objects
  for select using (
    bucket_id = 'po-attachments'
    and (storage.foldername(name))[1]::uuid in (select auth.user_workspace_ids())
  );

-- Write: only PM/owner who owns the draft PO referenced by the second path segment.
drop policy if exists "po_attachments_write_owner_draft" on storage.objects;
create policy "po_attachments_write_owner_draft" on storage.objects
  for insert with check (
    bucket_id = 'po-attachments'
    and exists (
      select 1 from public.purchase_orders po
      where po.id::text = (storage.foldername(name))[2]
        and po.workspace_id::text = (storage.foldername(name))[1]
        and po.created_by = auth.uid()
        and po.status = 'draft'
    )
  );
