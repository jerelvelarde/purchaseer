"use client";

import Link from "next/link";
import { usePolling } from "@/lib/use-polling";
import { centavosToPeso, computePercentUsed } from "@/lib/dashboard/money";
import type { ProjectRow } from "@/lib/dashboard/queries";

async function fetchCompany(): Promise<{ projects: ProjectRow[] }> {
  const res = await fetch("/api/dashboard/company", { cache: "no-store" });
  if (!res.ok) throw new Error(`Dashboard error ${res.status}`);
  return res.json();
}

export function CompanyDashboardClient() {
  const { data, error, loading } = usePolling(fetchCompany, { intervalMs: 5000 });

  if (loading && !data) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error.message}</p>;
  }
  const projects = data?.projects ?? [];
  if (projects.length === 0) {
    return <p className="text-sm text-slate-500">No projects yet.</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <li key={p.project_id}>
          <Link
            href={`/dashboard/projects/${p.project_id}`}
            className="block rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ProjectCard p={p} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ProjectCard({ p }: { p: ProjectRow }) {
  const pct = computePercentUsed(p.spend_centavos, p.budget_centavos);
  const pctClamped = Math.min(100, Math.max(0, pct));
  const over = pct > 100;
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-medium text-slate-900">{p.name}</h2>
        {p.pending_po_count > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {p.pending_po_count} pending
          </span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-slate-500">Budget</dt>
        <dd className="text-right text-slate-900">{centavosToPeso(p.budget_centavos)}</dd>
        <dt className="text-slate-500">Spend</dt>
        <dd className="text-right text-slate-900">{centavosToPeso(p.spend_centavos)}</dd>
        <dt className="text-slate-500">% used</dt>
        <dd className={`text-right font-medium ${over ? "text-red-600" : "text-slate-900"}`}>
          {pct.toFixed(1)}%
        </dd>
      </dl>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full ${over ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${pctClamped}%` }}
        />
      </div>
    </div>
  );
}
