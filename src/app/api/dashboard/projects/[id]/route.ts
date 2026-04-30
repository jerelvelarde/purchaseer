import { NextResponse } from "next/server";
import {
  fetchProjectDashboard,
  resolveCurrentWorkspace,
  userCanAccessProject,
} from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const ctx = await resolveCurrentWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const allowed = await userCanAccessProject(ctx.workspaceId, id, ctx.userId, ctx.role);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await fetchProjectDashboard(ctx.workspaceId, id);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load project" },
      { status: 500 },
    );
  }
}
