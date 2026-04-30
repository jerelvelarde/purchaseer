/**
 * Minimal local approval transition. Duplicates a tiny slice of the full PO
 * state machine (added by issue #4 in `src/lib/po/state-machine.ts`) so that
 * this branch builds even if #4 hasn't merged. Will dedupe post-merge.
 */
export type PoStatus = "draft" | "pending" | "approved" | "rejected";
export type ApprovalAction = "approve" | "reject";

export function transitionApproval(
  from: PoStatus,
  action: ApprovalAction,
): PoStatus {
  if (from !== "pending") {
    throw new Error(
      `Invalid approval transition: PO must be 'pending' (got '${from}')`,
    );
  }
  return action === "approve" ? "approved" : "rejected";
}
