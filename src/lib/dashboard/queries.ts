import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProjectRow = {
  project_id: string;
  name: string;
  budget_centavos: number;
  spend_centavos: number;
  percent_used: number;
  pending_po_count: number;
};

export type PoRow = {
  id: string;
  po_number: string;
  supplier_name: string;
  total_centavos: number;
  status: string;
  created_at: string;
};

type ProjectAggInput = {
  id: string;
  name: string;
  budget_centavos: number | null;
  pos: { total_centavos: number | null; status: string }[] | null;
};

function aggregate(p: ProjectAggInput): ProjectRow {
  const pos = p.pos ?? [];
  let spend = 0;
  let pending = 0;
  for (const po of pos) {
    if (po.status === "approved") spend += po.total_centavos ?? 0;
    if (po.status === "pending") pending += 1;
  }
  const budget = p.budget_centavos ?? 0;
  const percent = budget > 0 ? (spend / budget) * 100 : 0;
  return {
    project_id: p.id,
    name: p.name,
    budget_centavos: budget,
    spend_centavos: spend,
    percent_used: percent,
    pending_po_count: pending,
  };
}

/**
 * Per-workspace per-project rollup. We rely on PostgREST's embedded select to
 * pull each project's POs in a single round-trip, then aggregate in JS. This
 * keeps things readable and avoids needing a SQL view from #3/#4.
 */
export async function fetchCompanyDashboard(workspaceId: string): Promise<ProjectRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, name, budget_centavos, pos:purchase_orders(total_centavos, status)",
    )
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as ProjectAggInput[];
  return rows.map(aggregate);
}

export async function fetchProjectDashboard(
  workspaceId: string,
  projectId: string,
): Promise<{ project: ProjectRow; pos: PoRow[] } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, name, budget_centavos, pos:purchase_orders(total_centavos, status)",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const project = aggregate(data as unknown as ProjectAggInput);

  const { data: poList, error: poErr } = await supabase
    .from("purchase_orders")
    .select("id, po_number, supplier_name, total_centavos, status, created_at")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (poErr) throw new Error(poErr.message);
  return { project, pos: (poList ?? []) as PoRow[] };
}

/**
 * Resolve the calling user's workspace + role. The dashboards are scoped to
 * the user's first active workspace (sprint-01 ships a single workspace per
 * user via E1).
 */
export async function resolveCurrentWorkspace(): Promise<
  | { ok: true; userId: string; workspaceId: string; role: "owner" | "pm" | "bookkeeper" }
  | { ok: false; status: 401 | 403; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("memberships")
    .select("workspace_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, status: 403, error: "No active workspace" };
  }
  return {
    ok: true,
    userId: user.id,
    workspaceId: data.workspace_id as string,
    role: data.role as "owner" | "pm" | "bookkeeper",
  };
}

/**
 * Project-level access: Owner OR the assigned PM of that project. We treat
 * `projects.assigned_pm_id` as the assignment column (per PLAN.md). If the
 * column shape from #3 differs, this is the single place to update.
 */
export async function userCanAccessProject(
  workspaceId: string,
  projectId: string,
  userId: string,
  role: "owner" | "pm" | "bookkeeper",
): Promise<boolean> {
  if (role === "owner") return true;
  if (role !== "pm") return false;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, assigned_pm_id")
    .eq("workspace_id", workspaceId)
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) return false;
  return (data as { assigned_pm_id?: string | null }).assigned_pm_id === userId;
}
