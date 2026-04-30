"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { centavosToPeso, pesoToCentavos } from "@/lib/money";

type ProjectInput = {
  id: string;
  name: string;
  budget_centavos: string;
  assigned_pm_id: string | null;
  status: "active" | "archived";
};

export function EditProjectForm({ project }: { project: ProjectInput }) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [budget, setBudget] = useState(
    centavosToPeso(BigInt(project.budget_centavos)),
  );
  const [assignedPmId, setAssignedPmId] = useState(project.assigned_pm_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "archive" | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("save");
    try {
      const budgetCentavos = pesoToCentavos(budget).toString();
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          budgetCentavos,
          assignedPmId: assignedPmId.trim() === "" ? null : assignedPmId.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onArchive() {
    if (!confirm("Archive this project? It will become read-only.")) return;
    setError(null);
    setBusy("archive");
    try {
      const res = await fetch(`/api/projects/${project.id}/archive`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={onSave} className="mt-3 space-y-3 rounded border p-4">
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
      <label className="block text-sm">
        Assigned PM (user id)
        <input
          className="mt-1 block w-full rounded border p-2"
          value={assignedPmId}
          onChange={(e) => setAssignedPmId(e.target.value)}
          placeholder="leave blank to unassign"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy !== null}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy === "save" ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onArchive}
          disabled={busy !== null}
          className="rounded border px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          {busy === "archive" ? "Archiving…" : "Archive"}
        </button>
      </div>
    </form>
  );
}
