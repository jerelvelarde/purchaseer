import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { centavosToPeso } from "@/lib/money";
import { canEditProject } from "@/lib/projects/access";
import type { Role } from "@/lib/auth/guards";
import { EditProjectForm } from "./edit-project-form";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, workspace_id, name, budget_centavos, assigned_pm_id, status, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!project) return notFound();

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("workspace_id", project.workspace_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const role = (membership?.role ?? "pm") as Role;
  const editable = canEditProject(role, project);

  const { data: history } = await supabase
    .from("project_budget_history")
    .select("id, old_centavos, new_centavos, actor_id, at")
    .eq("project_id", id)
    .order("at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/projects" className="text-sm text-slate-500 hover:underline">
        ← Projects
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {project.name}
      </h1>
      <p className="text-sm text-slate-500">
        Status: {project.status} · Budget: ₱
        {centavosToPeso(BigInt(project.budget_centavos))}
      </p>

      {editable ? (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-slate-700">Edit</h2>
          <EditProjectForm
            project={{
              id: project.id,
              name: project.name,
              budget_centavos: String(project.budget_centavos),
              assigned_pm_id: project.assigned_pm_id,
              status: project.status,
            }}
          />
        </section>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          {project.status === "archived"
            ? "This project is archived."
            : "Read-only view."}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium text-slate-700">Budget history</h2>
        {(history ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No budget changes yet.</p>
        ) : (
          <ul className="mt-2 divide-y rounded border text-sm">
            {(history ?? []).map((h) => (
              <li key={h.id} className="p-3">
                <div className="text-slate-900">
                  ₱{centavosToPeso(BigInt(h.old_centavos))} → ₱
                  {centavosToPeso(BigInt(h.new_centavos))}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(h.at).toLocaleString()} ·{" "}
                  {h.actor_id ?? "system"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
