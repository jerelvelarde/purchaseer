import { describe, it, expect } from "vitest";
import { buildApprovalEmail } from "@/lib/email/po-decision";

describe("buildApprovalEmail", () => {
  it("formats an approval email", () => {
    const e = buildApprovalEmail({
      poNumber: "PO-001",
      action: "approve",
      poUrl: "https://app.test/pos/abc",
    });
    expect(e.subject).toBe("PO PO-001 approved");
    expect(e.text).toContain("approved");
    expect(e.text).toContain("https://app.test/pos/abc");
    expect(e.html).toContain("https://app.test/pos/abc");
  });

  it("formats a rejection email and includes the decision note", () => {
    const e = buildApprovalEmail({
      poNumber: "PO-002",
      action: "reject",
      poUrl: "https://app.test/pos/xyz",
      decisionNote: "Budget exceeded",
    });
    expect(e.subject).toBe("PO PO-002 rejected");
    expect(e.text).toContain("Budget exceeded");
    expect(e.html).toContain("Budget exceeded");
  });

  it("omits the reason block when no note on rejection", () => {
    const e = buildApprovalEmail({
      poNumber: "PO-003",
      action: "reject",
      poUrl: "https://app.test/pos/xyz",
    });
    expect(e.text).not.toContain("Reason:");
    expect(e.html).not.toContain("Reason:");
  });

  it("escapes HTML in po number and decision note", () => {
    const e = buildApprovalEmail({
      poNumber: "<bad>",
      action: "reject",
      poUrl: "https://app.test/pos/xyz",
      decisionNote: "<script>alert(1)</script>",
    });
    expect(e.html).not.toContain("<script>alert(1)</script>");
    expect(e.html).toContain("&lt;script&gt;");
    expect(e.html).toContain("&lt;bad&gt;");
  });
});
