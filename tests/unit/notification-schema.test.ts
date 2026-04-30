import { describe, it, expect } from "vitest";
import {
  notificationKindSchema,
  notificationPayloadSchema,
} from "@/lib/notifications/schema";
import { transitionApproval } from "@/lib/po/approval-machine";

const UUID = "00000000-0000-4000-8000-000000000000";

describe("notificationPayloadSchema", () => {
  it("accepts a minimal valid payload", () => {
    const r = notificationPayloadSchema.safeParse({
      po_id: UUID,
      po_number: "PO-1",
      project_id: UUID,
    });
    expect(r.success).toBe(true);
  });

  it("accepts a payload with decision_note", () => {
    const r = notificationPayloadSchema.safeParse({
      po_id: UUID,
      po_number: "PO-1",
      project_id: UUID,
      decision_note: "nope",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a missing po_number", () => {
    const r = notificationPayloadSchema.safeParse({
      po_id: UUID,
      project_id: UUID,
    });
    expect(r.success).toBe(false);
  });

  it("rejects bad uuids", () => {
    const r = notificationPayloadSchema.safeParse({
      po_id: "not-a-uuid",
      po_number: "PO-1",
      project_id: UUID,
    });
    expect(r.success).toBe(false);
  });

  it("kinds are constrained to po.approved | po.rejected", () => {
    expect(notificationKindSchema.safeParse("po.approved").success).toBe(true);
    expect(notificationKindSchema.safeParse("po.rejected").success).toBe(true);
    expect(notificationKindSchema.safeParse("po.other").success).toBe(false);
  });
});

describe("transitionApproval", () => {
  it("approves a pending PO", () => {
    expect(transitionApproval("pending", "approve")).toBe("approved");
  });
  it("rejects a pending PO", () => {
    expect(transitionApproval("pending", "reject")).toBe("rejected");
  });
  it("throws on non-pending source state", () => {
    expect(() => transitionApproval("draft", "approve")).toThrow();
    expect(() => transitionApproval("approved", "reject")).toThrow();
  });
});
