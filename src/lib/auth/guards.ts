import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Role = "owner" | "pm" | "bookkeeper";

export type RoleCheckResult =
  | { ok: true; userId: string; workspaceId: string; role: Role }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Verify the current authenticated user has at least the requested role
 * within the given workspace. Designed to run inside a Route Handler
 * (middleware can't easily read role from RLS).
 */
export async function requireRole(
  workspaceId: string,
  required: Role,
): Promise<RoleCheckResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, status: 401, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data || data.status !== "active") {
    return { ok: false, status: 403, error: "Not a member of this workspace" };
  }

  if (!roleSatisfies(data.role as Role, required)) {
    return { ok: false, status: 403, error: `Requires role: ${required}` };
  }

  return {
    ok: true,
    userId: user.id,
    workspaceId,
    role: data.role as Role,
  };
}

const RANK: Record<Role, number> = { bookkeeper: 1, pm: 2, owner: 3 };

/**
 * Strictly: owner satisfies any required role; pm satisfies pm/bookkeeper;
 * bookkeeper satisfies bookkeeper.
 */
export function roleSatisfies(actual: Role, required: Role): boolean {
  return RANK[actual] >= RANK[required];
}
