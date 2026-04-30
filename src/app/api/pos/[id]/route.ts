import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UpdatePOInput } from "@/lib/po/types";
import { canEdit } from "@/lib/po/state-machine";
import { lineTotalCentavos, sumCentavos } from "@/lib/money";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: lineItems }, { data: attachments }, { data: history }] =
    await Promise.all([
      supabase.from("po_line_items").select("*").eq("po_id", id).order("created_at"),
      supabase.from("po_attachments").select("*").eq("po_id", id).order("created_at"),
      supabase.from("po_status_history").select("*").eq("po_id", id).order("at"),
    ]);

  return NextResponse.json({
    purchase_order: po,
    line_items: lineItems ?? [],
    attachments: attachments ?? [],
    status_history: history ?? [],
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let parsed;
  try {
    parsed = UpdatePOInput.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: (err as Error).message },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .select("id, status, created_by, workspace_id")
    .eq("id", id)
    .maybeSingle();

  if (poErr) return NextResponse.json({ error: poErr.message }, { status: 500 });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (po.created_by !== user.id) {
    return NextResponse.json({ error: "Not your draft" }, { status: 403 });
  }
  if (!canEdit(po.status)) {
    return NextResponse.json(
      { error: `Cannot edit PO in status ${po.status}` },
      { status: 409 },
    );
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.supplier_name !== undefined) update.supplier_name = parsed.supplier_name;
  if (parsed.note !== undefined) update.note = parsed.note;

  if (parsed.line_items) {
    const lineTotals = parsed.line_items.map((li) =>
      lineTotalCentavos(li.qty, li.unit_price_centavos),
    );
    update.total_centavos = sumCentavos(lineTotals);

    // Replace line items wholesale (simplest semantics for draft edits).
    const { error: delErr } = await supabase
      .from("po_line_items")
      .delete()
      .eq("po_id", id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    if (parsed.line_items.length > 0) {
      const { error: insErr } = await supabase.from("po_line_items").insert(
        parsed.line_items.map((li, i) => ({
          po_id: id,
          description: li.description,
          qty: li.qty,
          unit_price_centavos: li.unit_price_centavos,
          line_total_centavos: lineTotals[i],
        })),
      );
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  const { error: updErr } = await supabase
    .from("purchase_orders")
    .update(update)
    .eq("id", id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
