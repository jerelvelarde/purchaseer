import { NextResponse } from "next/server";
import { z } from "zod";
import { decidePurchaseOrder } from "@/lib/po/decision";

const Body = z.object({ note: z.string().max(2000).optional() });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  let note: string | undefined;
  try {
    const raw = await req.text();
    if (raw.trim().length > 0) {
      note = Body.parse(JSON.parse(raw)).note;
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: (err as Error).message },
      { status: 400 },
    );
  }

  return decidePurchaseOrder({
    poId: id,
    action: "reject",
    decisionNote: note,
    origin: req.headers.get("origin"),
  });
}
