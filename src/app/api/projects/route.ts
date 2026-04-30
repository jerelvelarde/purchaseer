import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";

/**
 * GET /api/projects?workspaceId=...
 * Returns projects in the workspace. RLS handles row-level filtering:
 *   - Owners + bookkeepers: all projects in the workspace
 *   - PMs: only projects assigned to them
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId query param required" },
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

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, budget_centavos, assigned_pm_id, status, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // budget_centavos comes back as string from supabase-js for bigint columns;
  // pass it through unchanged. UI converts via pesoToCentavos / centavosToPeso.
  return NextResponse.json({ projects: data ?? [] });
}

const CreateBody = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(200),
  // Accept centavos as string (bigint-safe over JSON) or number.
  budgetCentavos: z
    .union([z.string(), z.number()])
    .transform((v) => {
      const s = typeof v === "number" ? Math.trunc(v).toString() : v;
      if (!/^-?\d+$/.test(s)) throw new Error("budgetCentavos must be an integer");
      return s;
    }),
  assignedPmId: z.string().uuid().nullable().optional(),
});

/**
 * POST /api/projects
 * Owner-only. Creates a project in the given workspace.
 */
export async function POST(req: Request) {
  let parsed;
  try {
    parsed = CreateBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: (err as Error).message },
      { status: 400 },
    );
  }

  const { workspaceId, name, budgetCentavos, assignedPmId } = parsed;

  const guard = await requireRole(workspaceId, "owner");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  // After requireRole, role === "owner" specifically (not just "satisfies").
  if (guard.role !== "owner") {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      name,
      budget_centavos: budgetCentavos,
      assigned_pm_id: assignedPmId ?? null,
      created_by: guard.userId,
    })
    .select("id, name, budget_centavos, assigned_pm_id, status, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create project" },
      { status: 500 },
    );
  }

  return NextResponse.json({ project: data }, { status: 201 });
}
