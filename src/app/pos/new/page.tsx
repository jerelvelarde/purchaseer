"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { centavosToPeso, lineTotalCentavos, sumCentavos } from "@/lib/po/money";
import { ALLOWED_ATTACHMENT_TYPES } from "@/lib/po/types";

type LineRow = { description: string; qty: string; unit_price_pesos: string };
type Workspace = { id: string; name: string };

function pesosToCentavos(p: string): number {
  const n = Number(p);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export default function NewPOPageWrapper() {
  return (
    <Suspense fallback={<main className="p-8">Loading…</main>}>
      <NewPOPage />
    </Suspense>
  );
}

function NewPOPage() {
  const router = useRouter();
  const params = useSearchParams();
  const projectId = params.get("projectId") ?? "";

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineRow[]>([
    { description: "", qty: "1", unit_price_pesos: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("memberships")
        .select("workspace:workspaces(id, name), role, status")
        .eq("status", "active");
      const list = ((data ?? []) as Array<{ workspace: Workspace | Workspace[] | null }>)
        .map((m) => (Array.isArray(m.workspace) ? m.workspace[0] : m.workspace))
        .filter((w): w is Workspace => !!w);
      setWorkspaces(list);
      if (list[0]) setWorkspaceId(list[0].id);
    })();
  }, []);

  const totalCentavos = useMemo(
    () =>
      sumCentavos(
        lines.map((l) => lineTotalCentavos(Number(l.qty || 0), pesosToCentavos(l.unit_price_pesos))),
      ),
    [lines],
  );

  function updateLine(i: number, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { description: "", qty: "1", unit_price_pesos: "" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/pos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          project_id: projectId,
          supplier_name: supplier,
          note: note || null,
          line_items: lines
            .filter((l) => l.description.trim().length > 0)
            .map((l) => ({
              description: l.description,
              qty: Number(l.qty),
              unit_price_centavos: pesosToCentavos(l.unit_price_pesos),
            })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      router.push(`/pos/${json.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">New Purchase Order</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Workspace</label>
          <select
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Project ID</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={projectId}
            readOnly
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Supplier</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Note</label>
          <textarea
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div>
          <h2 className="text-lg font-medium">Line items</h2>
          <p className="text-xs text-slate-500">
            Allowed file types on next step: {ALLOWED_ATTACHMENT_TYPES.join(", ")}
          </p>
          <div className="mt-2 space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="flex-1 rounded border border-slate-300 p-2"
                  placeholder="Description"
                  value={l.description}
                  onChange={(e) => updateLine(i, { description: e.target.value })}
                />
                <input
                  className="w-20 rounded border border-slate-300 p-2"
                  placeholder="Qty"
                  value={l.qty}
                  onChange={(e) => updateLine(i, { qty: e.target.value })}
                />
                <input
                  className="w-32 rounded border border-slate-300 p-2"
                  placeholder="Unit ₱"
                  value={l.unit_price_pesos}
                  onChange={(e) => updateLine(i, { unit_price_pesos: e.target.value })}
                />
                <button type="button" onClick={() => removeLine(i)} className="text-sm">
                  remove
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addLine} className="mt-2 text-sm underline">
            + add line
          </button>
          <p className="mt-2 text-sm">Total: {centavosToPeso(totalCentavos)}</p>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={busy || !workspaceId || !projectId}
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create draft"}
        </button>
      </form>
    </main>
  );
}
