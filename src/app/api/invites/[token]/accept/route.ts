import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { hashInviteToken, isInviteExpired } from "@/lib/auth/tokens";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const Body = z.object({
  password: z.string().min(8),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const ip = clientIp(req);
  const rl = rateLimit(`invite-accept:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { token } = await params;
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: (err as Error).message },
      { status: 400 },
    );
  }

  const tokenHash = hashInviteToken(token);

  // Service-role: invite acceptors are not yet authed for this workspace.
  const admin = createSupabaseServiceRoleClient();

  const { data: invite, error: inviteErr } = await admin
    .from("invites")
    .select("id, workspace_id, email, role, expires_at, accepted_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (inviteErr || !invite) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  }
  if (invite.accepted_at) {
    return NextResponse.json(
      { error: "Invite already accepted" },
      { status: 410 },
    );
  }
  if (isInviteExpired(invite.expires_at)) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  // Find or create the auth user for this email.
  let userId: string | undefined;
  const { data: existingList } = await admin.auth.admin.listUsers();
  const existing = existingList.users.find(
    (u) => (u.email ?? "").toLowerCase() === invite.email.toLowerCase(),
  );
  if (existing) {
    userId = existing.id;
  } else {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: invite.email,
        password: parsed.password,
        email_confirm: true,
      });
    if (createErr || !created.user) {
      return NextResponse.json(
        { error: createErr?.message ?? "Failed to create user" },
        { status: 500 },
      );
    }
    userId = created.user.id;
  }

  // Upsert active membership.
  const { error: memErr } = await admin.from("memberships").upsert(
    {
      workspace_id: invite.workspace_id,
      user_id: userId,
      role: invite.role,
      status: "active",
    },
    { onConflict: "workspace_id,user_id" },
  );
  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  const { error: acceptErr } = await admin
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);
  if (acceptErr) {
    return NextResponse.json({ error: acceptErr.message }, { status: 500 });
  }

  // Sign the new (or existing) user in by setting an SSR session.
  const supabase = await createSupabaseServerClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password: parsed.password,
  });
  // Don't fail the whole request if sign-in fails (existing user may have a
  // different password); the invite has already been accepted.
  const signedIn = !signInErr;

  return NextResponse.json({
    workspaceId: invite.workspace_id,
    role: invite.role,
    signedIn,
  });
}
