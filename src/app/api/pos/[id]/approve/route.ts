import { decidePurchaseOrder } from "@/lib/po/decision";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return decidePurchaseOrder({
    poId: id,
    action: "approve",
    origin: req.headers.get("origin"),
  });
}
