import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { centavosToPeso } from "@/lib/money";
import { NewProjectForm } from "./new-project-form";

export const dynamic = "force-dynamic";

/**
 * /projects — list + create form.
 *
 * Shows projects across all workspaces the user is a member of. RLS scopes
 * by workspace and (for PMs) by assignment. The create form is shown for
 * each workspace where the user is an owner.
 */
export default async function ProjectsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("workspace_id, role, workspaces(name)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const ownerWorkspaces = (memberships ?? []).filter((m) => m.role === "owner");

  const { data: projects } = await supabase
    .from("projects")
    .select("id, workspace_id, name, budget_centavos, assigned_pm_id, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-slate-700">Your projects</h2>
        {(projects ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No projects yet.</p>
        ) : (
          <ul className="mt-2 divide-y rounded border">
            {(projects ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between p-3">
                <div>
                  <Link
                    href={`/projects/${p.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {p.name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    Budget: ₱{centavosToPeso(BigInt(p.budget_centavos))} ·{" "}
                    {p.status}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ownerWorkspaces.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-slate-700">
            Create a project
          </h2>
          <NewProjectForm
            workspaces={ownerWorkspaces.map((m) => ({
              id: m.workspace_id,
              // workspaces is joined; supabase-js types it as array | object.
              name:
                (Array.isArray(m.workspaces)
                  ? m.workspaces[0]?.name
                  : (m.workspaces as { name?: string } | null)?.name) ??
                "Workspace",
            }))}
          />
        </section>
      )}
    </main>
  );
}
