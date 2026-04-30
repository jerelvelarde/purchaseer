import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";

/**
 * POST /api/projects/:id/archive
 * Owner only. Sets status='archived'. Idempotent.
 */
export async function POST(
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
    return NextResponse.json({ project: { id, status: "archived" } });
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ status: "archived" })
    .eq("id", id)
    .select("id, status")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to archive project" },
      { status: 500 },
    );
  }

  return NextResponse.json({ project: data });
}
