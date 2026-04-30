import type { Role } from "@/lib/auth/guards";

export type ProjectAccessShape = {
  assigned_pm_id: string | null;
  status?: "active" | "archived";
};

/**
 * Owners can edit any project in their workspace.
 * PMs and bookkeepers cannot edit projects (RLS also enforces this).
 * Archived projects are read-only.
 */
export function canEditProject(
  role: Role,
  project: ProjectAccessShape,
): boolean {
  if (project.status === "archived") return false;
  return role === "owner";
}

/**
 * SELECT permission mirror of the RLS policy. Useful for UI gating.
 */
export function canViewProject(
  role: Role,
  userId: string,
  project: ProjectAccessShape,
): boolean {
  if (role === "owner" || role === "bookkeeper") return true;
  if (role === "pm") return project.assigned_pm_id === userId;
  return false;
}
