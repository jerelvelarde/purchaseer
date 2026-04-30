import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ALLOWED_ATTACHMENT_TYPES } from "@/lib/po/types";

const Body = z.object({
  filename: z.string().min(1).max(255),
  content_type: z.enum(ALLOWED_ATTACHMENT_TYPES),
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
      { error: `Cannot upload to PO in status ${po.status}` },
      { status: 409 },
    );
  }

  // Sanitize filename — strip path segments, keep base name only.
  const safe = parsed.filename.replace(/[/\\]/g, "_");
  const path = `${po.workspace_id}/${po.id}/${Date.now()}-${safe}`;

  const { data, error } = await supabase.storage
    .from("po-attachments")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to sign upload" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    storage_path: path,
    signed_url: data.signedUrl,
    token: data.token,
    content_type: parsed.content_type,
  });
}
