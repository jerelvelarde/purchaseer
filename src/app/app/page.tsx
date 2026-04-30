import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppHome() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("role, status, workspace:workspaces(id, name)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const rows = memberships ?? [];

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Your workspaces</h1>
      <p className="mt-1 text-sm text-slate-500">Signed in as {user.email}</p>
      <ul className="mt-6 space-y-3">
        {rows.length === 0 && (
          <li className="text-sm text-slate-600">No active memberships.</li>
        )}
        {rows.map((m) => {
          const wsField = (
            m as unknown as {
              workspace:
                | { id: string; name: string }
                | { id: string; name: string }[]
                | null;
            }
          ).workspace;
          const ws = Array.isArray(wsField) ? wsField[0] : wsField;
          if (!ws) return null;
          return (
            <li
              key={ws.id}
              className="flex items-center justify-between rounded-md border border-slate-200 p-4"
            >
              <span className="font-medium">{ws.name}</span>
              <span className="text-xs uppercase tracking-wide text-slate-500">
                {m.role}
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
