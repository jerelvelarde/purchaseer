"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { centavosToPeso } from "@/lib/po/money";
import { ALLOWED_ATTACHMENT_TYPES, type AllowedAttachmentType } from "@/lib/po/types";

type PO = {
  id: string;
  status: "draft" | "pending" | "approved" | "rejected";
  po_number: string | null;
  supplier_name: string;
  total_centavos: number;
  note: string | null;
  created_by: string;
  workspace_id: string;
};

type LineItem = {
  id: string;
  description: string;
  qty: number;
  unit_price_centavos: number;
  line_total_centavos: number;
};

type Attachment = {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
};

export default function POPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [po, setPo] = useState<PO | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/pos/${id}`);
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error ?? "Failed to load");
      return;
    }
    setPo(json.purchase_order);
    setItems(json.line_items);
    setAttachments(json.attachments);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/pos/${id}/submit`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    if (!po) return;
    setErr(null);
    setBusy(true);
    try {
      if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type as AllowedAttachmentType)) {
        throw new Error(`Unsupported file type: ${file.type}`);
      }

      const signRes = await fetch(`/api/pos/${id}/attachments/sign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, content_type: file.type }),
      });
      const signJson = await signRes.json();
      if (!signRes.ok) throw new Error(signJson.error ?? "Failed to sign");

      const supabase = createSupabaseBrowserClient();
      const { error: upErr } = await supabase.storage
        .from("po-attachments")
        .uploadToSignedUrl(signJson.storage_path, signJson.token, file, {
          contentType: file.type,
        });
      if (upErr) throw upErr;

      const metaRes = await fetch(`/api/pos/${id}/attachments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storage_path: signJson.storage_path,
          filename: file.name,
          content_type: file.type,
          size_bytes: file.size,
        }),
      });
      const metaJson = await metaRes.json();
      if (!metaRes.ok) throw new Error(metaJson.error ?? "Failed to record");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (err && !po) return <main className="p-8 text-red-600">{err}</main>;
  if (!po) return <main className="p-8">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">
          {po.po_number ?? "Draft PO"}{" "}
          <span className="ml-2 text-sm uppercase tracking-wide text-slate-500">
            {po.status}
          </span>
        </h1>
      </header>

      <section className="mt-4 rounded border border-slate-200 p-4">
        <p>
          <span className="font-medium">Supplier:</span> {po.supplier_name}
        </p>
        <p>
          <span className="font-medium">Total:</span> {centavosToPeso(po.total_centavos)}
        </p>
        {po.note && <p className="mt-2 text-sm">{po.note}</p>}
      </section>

      <section className="mt-4">
        <h2 className="text-lg font-medium">Line items</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {items.map((li) => (
            <li key={li.id} className="flex justify-between">
              <span>
                {li.description} ({li.qty} × {centavosToPeso(li.unit_price_centavos)})
              </span>
              <span>{centavosToPeso(li.line_total_centavos)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4">
        <h2 className="text-lg font-medium">Attachments</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {attachments.map((a) => (
            <li key={a.id}>
              {a.filename} <span className="text-slate-500">({a.content_type})</span>
            </li>
          ))}
        </ul>
        {po.status === "draft" && (
          <input
            type="file"
            accept={ALLOWED_ATTACHMENT_TYPES.join(",")}
            className="mt-2"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
            }}
          />
        )}
      </section>

      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

      {po.status === "draft" && (
        <button
          type="button"
          onClick={submit}
          disabled={busy || items.length === 0}
          className="mt-6 rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Submitting..." : "Submit for approval"}
        </button>
      )}
      <button
        type="button"
        onClick={() => router.push("/app")}
        className="mt-6 ml-2 rounded border border-slate-300 px-4 py-2 text-sm"
      >
        Back
      </button>
    </main>
  );
}
