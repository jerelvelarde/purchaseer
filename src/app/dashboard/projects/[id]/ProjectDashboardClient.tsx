"use client";

import { usePolling } from "@/lib/use-polling";
import { centavosToPeso, computePercentUsed } from "@/lib/dashboard/money";
import type { PoRow, ProjectRow } from "@/lib/dashboard/queries";

type ProjectPayload = { project: ProjectRow; pos: PoRow[] };

export function ProjectDashboardClient({ projectId }: { projectId: string }) {
  const { data, error, loading } = usePolling<ProjectPayload>(
    async () => {
      const res = await fetch(`/api/dashboard/projects/${projectId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Project dashboard error ${res.status}`);
      return res.json();
    },
    { intervalMs: 5000 },
  );

  if (loading && !data) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error.message}</p>;
  }
  if (!data) return null;

  const { project, pos } = data;
  const pct = computePercentUsed(project.spend_centavos, project.budget_centavos);
  const pctClamped = Math.min(100, Math.max(0, pct));
  const over = pct > 100;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="text-lg font-medium">{project.name}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
          <dt className="text-slate-500">Budget</dt>
          <dd className="text-slate-900 sm:text-right">
            {centavosToPeso(project.budget_centavos)}
          </dd>
          <dt className="text-slate-500">Spend</dt>
          <dd className="text-slate-900 sm:text-right">
            {centavosToPeso(project.spend_centavos)}
          </dd>
          <dt className="text-slate-500">% used</dt>
          <dd className={`sm:text-right font-medium ${over ? "text-red-600" : "text-slate-900"}`}>
            {pct.toFixed(1)}%
          </dd>
          <dt className="text-slate-500">Pending POs</dt>
          <dd className="text-slate-900 sm:text-right">{project.pending_po_count}</dd>
        </dl>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full ${over ? "bg-red-500" : "bg-emerald-500"}`}
            style={{ width: `${pctClamped}%` }}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-slate-700">Purchase orders</h3>
        {pos.length === 0 ? (
          <p className="text-sm text-slate-500">No POs yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {pos.map((po) => (
              <li key={po.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{po.po_number}</p>
                  <p className="truncate text-slate-500">{po.supplier_name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-slate-900">{centavosToPeso(po.total_centavos)}</span>
                  <StatusPill status={po.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-800",
    pending: "bg-amber-100 text-amber-800",
    rejected: "bg-red-100 text-red-800",
    draft: "bg-slate-100 text-slate-700",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
