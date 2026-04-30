"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pesoToCentavos } from "@/lib/money";

type Workspace = { id: string; name: string };

export function NewProjectForm({ workspaces }: { workspaces: Workspace[] }) {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("0.00");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const budgetCentavos = pesoToCentavos(budget).toString();
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId, name, budgetCentavos }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      router.refresh();
      setName("");
      setBudget("0.00");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3 rounded border p-4">
      {workspaces.length > 1 && (
        <label className="block text-sm">
          Workspace
          <select
            className="mt-1 block w-full rounded border p-2"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-sm">
        Name
        <input
          className="mt-1 block w-full rounded border p-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        Budget (₱)
        <input
          className="mt-1 block w-full rounded border p-2"
          inputMode="decimal"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          required
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !workspaceId}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
