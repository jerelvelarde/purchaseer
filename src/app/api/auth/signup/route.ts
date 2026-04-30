import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  workspaceName: z.string().min(1).max(100),
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`signup:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: (err as Error).message },
      { status: 400 },
    );
  }

  const { email, password, workspaceName } = parsed;

  // Use the SSR client so the new session is written to the response cookies.
  const supabase = await createSupabaseServerClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError || !signUpData.user) {
    return NextResponse.json(
      { error: signUpError?.message ?? "Signup failed" },
      { status: 400 },
    );
  }

  const userId = signUpData.user.id;

  // Workspace + owner membership are created with the service-role client so
  // we don't have to wait for/depend on email confirmation flows. RLS would
  // otherwise block the very-first INSERT (chicken/egg: no membership yet).
  const admin = createSupabaseServiceRoleClient();

  const { data: workspace, error: wsError } = await admin
    .from("workspaces")
    .insert({ name: workspaceName })
    .select("id, name")
    .single();

  if (wsError || !workspace) {
    return NextResponse.json(
      { error: wsError?.message ?? "Failed to create workspace" },
      { status: 500 },
    );
  }

  const { error: memError } = await admin.from("memberships").insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: "owner",
    status: "active",
  });

  if (memError) {
    return NextResponse.json({ error: memError.message }, { status: 500 });
  }

  return NextResponse.json({
    workspace: { id: workspace.id, name: workspace.name },
    user: { id: userId, email },
  });
}
