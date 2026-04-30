import { describe, it, expect } from "vitest";
import { transition, canEdit, type POStatus, type POAction } from "@/lib/po/state-machine";

describe("PO state machine", () => {
  it("null --create--> draft", () => {
    expect(transition(null, "create")).toEqual({ ok: true, to: "draft" });
  });

  it("draft --submit--> pending", () => {
    expect(transition("draft", "submit")).toEqual({ ok: true, to: "pending" });
  });

  it("pending --approve--> approved", () => {
    expect(transition("pending", "approve")).toEqual({ ok: true, to: "approved" });
  });

  it("pending --reject--> rejected", () => {
    expect(transition("pending", "reject")).toEqual({ ok: true, to: "rejected" });
  });

  const illegal: Array<[POStatus | null, POAction]> = [
    [null, "submit"],
    [null, "approve"],
    [null, "reject"],
    ["draft", "create"],
    ["draft", "approve"],
    ["draft", "reject"],
    ["pending", "create"],
    ["pending", "submit"],
    ["approved", "create"],
    ["approved", "submit"],
    ["approved", "approve"],
    ["approved", "reject"],
    ["rejected", "create"],
    ["rejected", "submit"],
    ["rejected", "approve"],
    ["rejected", "reject"],
  ];

  it.each(illegal)("rejects illegal transition %s --%s-->", (from, action) => {
    const r = transition(from, action);
    expect(r.ok).toBe(false);
  });

  it("canEdit only true for draft", () => {
    expect(canEdit("draft")).toBe(true);
    expect(canEdit("pending")).toBe(false);
    expect(canEdit("approved")).toBe(false);
    expect(canEdit("rejected")).toBe(false);
  });
});
