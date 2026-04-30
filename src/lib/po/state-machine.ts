/**
 * Purchase Order state machine.
 *
 *   [null] --create--> draft --submit--> pending --approve--> approved
 *                                                  \--reject--> rejected
 *
 * Edits are only allowed in `draft`. Rejected POs cannot be re-submitted —
 * the PM clones into a new draft instead. No backwards transitions.
 */

export type POStatus = "draft" | "pending" | "approved" | "rejected";
export type POAction = "create" | "submit" | "approve" | "reject";

export type TransitionResult =
  | { ok: true; to: POStatus }
  | { ok: false; error: string };

export function transition(
  from: POStatus | null,
  action: POAction,
): TransitionResult {
  if (from === null && action === "create") return { ok: true, to: "draft" };
  if (from === "draft" && action === "submit") return { ok: true, to: "pending" };
  if (from === "pending" && action === "approve")
    return { ok: true, to: "approved" };
  if (from === "pending" && action === "reject")
    return { ok: true, to: "rejected" };

  return {
    ok: false,
    error: `Illegal transition: ${from ?? "null"} --${action}-->`,
  };
}

export function canEdit(status: POStatus): boolean {
  return status === "draft";
}
