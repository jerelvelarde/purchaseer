-- Extend PO read policies so a PM can also read POs for projects where they
-- are the assigned PM (projects.assigned_pm_id), not just POs they created.
-- Owners are unaffected (already see everything in their workspace).

create or replace function public.is_assigned_pm_of_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.assigned_pm_id = auth.uid()
  );
$$;

drop policy if exists "po_select" on public.purchase_orders;
create policy "po_select" on public.purchase_orders
  for select using (
    workspace_id in (select auth.user_workspace_ids())
    and (
      public.is_workspace_owner(workspace_id)
      or created_by = auth.uid()
      or public.is_assigned_pm_of_project(project_id)
    )
  );

drop policy if exists "poli_select" on public.po_line_items;
create policy "poli_select" on public.po_line_items
  for select using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = po_line_items.po_id
        and po.workspace_id in (select auth.user_workspace_ids())
        and (
          public.is_workspace_owner(po.workspace_id)
          or po.created_by = auth.uid()
          or public.is_assigned_pm_of_project(po.project_id)
        )
    )
  );

drop policy if exists "poa_select" on public.po_attachments;
create policy "poa_select" on public.po_attachments
  for select using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = po_attachments.po_id
        and po.workspace_id in (select auth.user_workspace_ids())
        and (
          public.is_workspace_owner(po.workspace_id)
          or po.created_by = auth.uid()
          or public.is_assigned_pm_of_project(po.project_id)
        )
    )
  );

drop policy if exists "posh_select" on public.po_status_history;
create policy "posh_select" on public.po_status_history
  for select using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = po_status_history.po_id
        and po.workspace_id in (select auth.user_workspace_ids())
        and (
          public.is_workspace_owner(po.workspace_id)
          or po.created_by = auth.uid()
          or public.is_assigned_pm_of_project(po.project_id)
        )
    )
  );
