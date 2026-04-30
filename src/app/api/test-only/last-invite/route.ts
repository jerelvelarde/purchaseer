import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Dev-only endpoint that returns the latest invite for a given email.
 *
 * Path note: lives under `/api/test-only/...` rather than `/api/_test/...`
 * because Next.js treats leading-underscore folders as private and excludes
 * them from routing.
 *
 * Gated by:
 *   1. NODE_ENV !== "production" — disabled entirely in prod builds
 *   2. Header `x-test-secret` must equal `process.env.TEST_INVITE_SECRET`
 *
 * Used by the Playwright golden path to "simulate accept" without a real
 * email round-trip.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const secret = process.env.TEST_INVITE_SECRET;
  if (!secret || req.headers.get("x-test-secret") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("invites")
    .select("id, workspace_id, email, role, token, token_hash, expires_at, accepted_at, created_at")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "no invite" }, { status: 404 });
  }
  return NextResponse.json({ invite: data });
}
