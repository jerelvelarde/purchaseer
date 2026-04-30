import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { transition } from "@/lib/po/state-machine";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .select("id, status, created_by, workspace_id, po_number, total_centavos")
    .eq("id", id)
    .maybeSingle();

  if (poErr) return NextResponse.json({ error: poErr.message }, { status: 500 });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (po.created_by !== user.id) {
    return NextResponse.json({ error: "Only the PM owner can submit" }, { status: 403 });
  }

  const t = transition(po.status, "submit");
  if (!t.ok) return NextResponse.json({ error: t.error }, { status: 409 });

  // Need at least one line item to submit.
  const { count: liCount } = await supabase
    .from("po_line_items")
    .select("id", { count: "exact", head: true })
    .eq("po_id", id);
  if (!liCount || liCount === 0) {
    return NextResponse.json(
      { error: "Cannot submit a PO with no line items" },
      { status: 400 },
    );
  }

  // Reserve the PO number via service-role (bypasses counter RLS) but only
  // after we've validated the user owns the draft above.
  const admin = createSupabaseServiceRoleClient();
  const { data: poNumberData, error: rpcErr } = await admin.rpc("next_po_number", {
    p_workspace_id: po.workspace_id,
  });
  if (rpcErr || !poNumberData) {
    return NextResponse.json(
      { error: rpcErr?.message ?? "Failed to assign PO number" },
      { status: 500 },
    );
  }
  const poNumber = poNumberData as unknown as string;

  const submittedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("purchase_orders")
    .update({
      status: t.to,
      po_number: poNumber,
      submitted_at: submittedAt,
      updated_at: submittedAt,
    })
    .eq("id", id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Status history. Service-role write — RLS denies direct inserts.
  const { error: histErr } = await admin.from("po_status_history").insert({
    po_id: id,
    from_status: po.status,
    to_status: t.to,
    actor_id: user.id,
  });
  if (histErr) {
    return NextResponse.json({ error: histErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, po_number: poNumber, status: t.to });
}
