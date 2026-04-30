import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { requireRole } from "@/lib/auth/guards";
import { generateInviteToken, hashInviteToken } from "@/lib/auth/tokens";
import { sendEmail, inviteEmail } from "@/lib/email/resend";

const Body = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["pm", "bookkeeper", "owner"]),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: (err as Error).message },
      { status: 400 },
    );
  }

  const { workspaceId, email, role } = parsed;

  const guard = await requireRole(workspaceId, "owner");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);

  // Owner has RLS access to insert; use the SSR client so policies apply.
  const supabase = await createSupabaseServerClient();
  const { data: invite, error } = await supabase
    .from("invites")
    .insert({
      workspace_id: workspaceId,
      email,
      role,
      token_hash: tokenHash,
    })
    .select("id, expires_at")
    .single();

  if (error || !invite) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create invite" },
      { status: 500 },
    );
  }

  // Look up workspace name for the email body. Use service-role to be safe
  // even though the owner has SELECT access via RLS.
  const admin = createSupabaseServiceRoleClient();
  const { data: ws } = await admin
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .single();

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const acceptUrl = `${origin}/accept-invite/${rawToken}`;

  const { subject, html, text } = inviteEmail({
    workspaceName: ws?.name ?? "your workspace",
    acceptUrl,
  });

  await sendEmail({ to: email, subject, html, text });

  return NextResponse.json({
    invite: { id: invite.id, email, role, expiresAt: invite.expires_at },
  });
}
