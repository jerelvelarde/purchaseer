import { NextResponse } from "next/server";
import {
  fetchCompanyDashboard,
  resolveCurrentWorkspace,
} from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await resolveCurrentWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "Owner role required" }, { status: 403 });
  }

  try {
    const projects = await fetchCompanyDashboard(ctx.workspaceId);
    return NextResponse.json({ projects });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load dashboard" },
      { status: 500 },
    );
  }
}
