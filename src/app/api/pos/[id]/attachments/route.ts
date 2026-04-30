import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ALLOWED_ATTACHMENT_TYPES } from "@/lib/po/types";

const Body = z.object({
  storage_path: z.string().min(1),
  filename: z.string().min(1).max(255),
  content_type: z.enum(ALLOWED_ATTACHMENT_TYPES),
  size_bytes: z.number().int().nonnegative(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let parsed;
  try {
    parsed = Body.parse(await req.json());
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

  // Path must start with `<workspace_id>/<po_id>/`.
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .select("id, workspace_id, created_by, status")
    .eq("id", id)
    .maybeSingle();
  if (poErr) return NextResponse.json({ error: poErr.message }, { status: 500 });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (po.created_by !== user.id) {
    return NextResponse.json({ error: "Not your draft" }, { status: 403 });
  }
  if (po.status !== "draft") {
    return NextResponse.json(
      { error: `Cannot attach to PO in status ${po.status}` },
      { status: 409 },
    );
  }

  const expectedPrefix = `${po.workspace_id}/${po.id}/`;
  if (!parsed.storage_path.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "storage_path outside scoped folder" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("po_attachments")
    .insert({
      po_id: id,
      storage_path: parsed.storage_path,
      filename: parsed.filename,
      content_type: parsed.content_type,
      size_bytes: parsed.size_bytes,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to record attachment" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id });
}
