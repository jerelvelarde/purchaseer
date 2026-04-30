import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";

/**
 * GET /api/projects/:id
 * RLS handles visibility (owner/bookkeeper: any in workspace; pm: assigned only).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, workspace_id, name, budget_centavos, assigned_pm_id, status, created_at, created_by",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Best-effort: surface budget history when the caller can read the project.
  // RLS applies the same predicate, so this is safe.
  const { data: history } = await supabase
    .from("project_budget_history")
    .select("id, old_centavos, new_centavos, actor_id, at")
    .eq("project_id", id)
    .order("at", { ascending: false })
    .limit(50);

  return NextResponse.json({ project: data, budgetHistory: history ?? [] });
}

const PatchBody = z.object({
  name: z.string().min(1).max(200).optional(),
  budgetCentavos: z
    .union([z.string(), z.number()])
    .transform((v) => {
      const s = typeof v === "number" ? Math.trunc(v).toString() : v;
      if (!/^-?\d+$/.test(s)) throw new Error("budgetCentavos must be an integer");
      return s;
    })
    .optional(),
  assignedPmId: z.string().uuid().nullable().optional(),
});

/**
 * PATCH /api/projects/:id
 * Owner only. Budget changes are audited by the trigger on `projects`.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  let parsed;
  try {
    parsed = PatchBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: (err as Error).message },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Look up workspace_id so we can role-check before we attempt the update.
  const { data: existing, error: lookupErr } = await supabase
    .from("projects")
    .select("id, workspace_id, status")
    .eq("id", id)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const guard = await requireRole(existing.workspace_id, "owner");
  if (!guard.ok || guard.role !== "owner") {
    return NextResponse.json(
      { error: guard.ok ? "Owner only" : guard.error },
      { status: guard.ok ? 403 : guard.status },
    );
  }

  if (existing.status === "archived") {
    return NextResponse.json(
      { error: "Cannot edit an archived project" },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.budgetCentavos !== undefined)
    patch.budget_centavos = parsed.budgetCentavos;
  if (parsed.assignedPmId !== undefined) patch.assigned_pm_id = parsed.assignedPmId;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select(
      "id, workspace_id, name, budget_centavos, assigned_pm_id, status, created_at",
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update project" },
      { status: 500 },
    );
  }

  return NextResponse.json({ project: data });
}
