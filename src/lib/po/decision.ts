import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { requireRole } from "@/lib/auth/guards";
import { sendEmail } from "@/lib/email/resend";
import { buildApprovalEmail } from "@/lib/email/po-decision";
import { transitionApproval, type ApprovalAction } from "@/lib/po/state-machine";
import {
  notificationPayloadSchema,
  type NotificationKind,
} from "@/lib/notifications/schema";

interface DecideArgs {
  poId: string;
  action: ApprovalAction;
  decisionNote?: string;
  origin?: string | null;
}

/**
 * Shared approve/reject flow. Steps (intentionally not wrapped in a single
 * transaction — Supabase JS doesn't expose multi-statement TX over PostgREST,
 * and a Postgres function felt heavier than warranted for sprint-01):
 *
 *   1. Update PO row (status, decided_by, decided_at, decision_note?). This
 *      is the "source of truth" write — if it fails, we abort.
 *   2. Insert `po_status_history` row. If this fails after step 1 succeeded,
 *      we report to Sentry but DO NOT roll back: the user-visible PO state is
 *      already correct, and a missing audit row is preferable to a confusing
 *      partial revert.
 *   3. Insert `notifications` row (service-role; RLS forbids inserts).
 *      Same non-fatal error policy.
 *   4. Send Resend email. Email failures are explicitly non-fatal — captured
 *      to Sentry, swallowed so the API still returns 200.
 */
export async function decidePurchaseOrder(args: DecideArgs) {
  const { poId, action, decisionNote, origin } = args;

  // Load the PO via service-role to avoid RLS gymnastics — we still gate on
  // the owner role explicitly via `requireRole` below.
  const admin = createSupabaseServiceRoleClient();
  const { data: po, error: poErr } = await admin
    .from("purchase_orders")
    .select(
      "id, workspace_id, project_id, po_number, status, created_by",
    )
    .eq("id", poId)
    .maybeSingle();

  if (poErr || !po) {
    return NextResponse.json({ error: "PO not found" }, { status: 404 });
  }

  const guard = await requireRole(po.workspace_id, "owner");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let nextStatus: "approved" | "rejected";
  try {
    nextStatus = transitionApproval(po.status, action) as "approved" | "rejected";
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 409 },
    );
  }

  const decidedAt = new Date().toISOString();

  // 1. Update PO. Use service-role since we've already authorized.
  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    decided_by: guard.userId,
    decided_at: decidedAt,
  };
  if (action === "reject") {
    updatePayload.decision_note = decisionNote ?? null;
  }

  const { error: updateErr } = await admin
    .from("purchase_orders")
    .update(updatePayload)
    .eq("id", poId)
    .eq("status", "pending"); // optimistic guard against races

  if (updateErr) {
    return NextResponse.json(
      { error: `Failed to update PO: ${updateErr.message}` },
      { status: 500 },
    );
  }

  // 2. Status history (non-fatal).
  const { error: histErr } = await admin.from("po_status_history").insert({
    po_id: poId,
    from_status: "pending",
    to_status: nextStatus,
    actor_id: guard.userId,
    note: action === "reject" ? decisionNote ?? null : null,
  });
  if (histErr) {
    Sentry.captureException(histErr, {
      tags: { area: "po.decision", step: "history" },
      extra: { poId },
    });
  }

  // 3. Notification (non-fatal).
  const kind: NotificationKind =
    action === "approve" ? "po.approved" : "po.rejected";
  const payload = notificationPayloadSchema.parse({
    po_id: po.id,
    po_number: po.po_number,
    project_id: po.project_id,
    ...(action === "reject" && decisionNote
      ? { decision_note: decisionNote }
      : {}),
  });

  const { error: notifErr } = await admin.from("notifications").insert({
    user_id: po.created_by,
    kind,
    payload,
  });
  if (notifErr) {
    Sentry.captureException(notifErr, {
      tags: { area: "po.decision", step: "notification" },
      extra: { poId },
    });
  }

  // 4. Email (non-fatal). Look up creator email via service-role auth.admin.
  try {
    const { data: userResp } = await admin.auth.admin.getUserById(po.created_by);
    const toEmail = userResp?.user?.email;
    if (toEmail) {
      const baseOrigin =
        origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const poUrl = `${baseOrigin}/pos/${po.id}`;
      const { subject, html, text } = buildApprovalEmail({
        poNumber: po.po_number,
        action,
        poUrl,
        decisionNote,
      });
      await sendEmail({ to: toEmail, subject, html, text });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "po.decision", step: "email" },
      extra: { poId },
    });
  }

  return NextResponse.json({
    po: { id: po.id, status: nextStatus, decided_at: decidedAt },
  });
}
