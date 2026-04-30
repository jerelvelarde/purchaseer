import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { CreatePOInput } from "@/lib/po/types";
import { lineTotalCentavos, sumCentavos } from "@/lib/money";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // RLS handles scoping (owner sees workspace, PM sees own).
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      "id, workspace_id, project_id, po_number, supplier_name, total_centavos, status, created_by, created_at, submitted_at",
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ purchase_orders: data ?? [] });
}

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = CreatePOInput.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: (err as Error).message },
      { status: 400 },
    );
  }

  const guard = await requireRole(parsed.workspace_id, "pm");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = await createSupabaseServerClient();

  const lineTotals = parsed.line_items.map((li) =>
    lineTotalCentavos(li.qty, li.unit_price_centavos),
  );
  const total = sumCentavos(lineTotals);

  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .insert({
      workspace_id: parsed.workspace_id,
      project_id: parsed.project_id,
      supplier_name: parsed.supplier_name,
      note: parsed.note ?? null,
      total_centavos: total,
      status: "draft",
      created_by: guard.userId,
    })
    .select("id")
    .single();

  if (poErr || !po) {
    return NextResponse.json(
      { error: poErr?.message ?? "Failed to create PO" },
      { status: 500 },
    );
  }

  if (parsed.line_items.length > 0) {
    const { error: liErr } = await supabase.from("po_line_items").insert(
      parsed.line_items.map((li, i) => ({
        po_id: po.id,
        description: li.description,
        qty: li.qty,
        unit_price_centavos: li.unit_price_centavos,
        line_total_centavos: lineTotals[i],
      })),
    );
    if (liErr) {
      return NextResponse.json({ error: liErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: po.id, status: "draft", total_centavos: total });
}
