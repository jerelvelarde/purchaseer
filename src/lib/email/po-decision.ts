/**
 * Email body builder for PO approval/rejection decisions. Pure function so it's
 * trivially unit-testable without spinning up Resend.
 */
export interface BuildApprovalEmailArgs {
  poNumber: string;
  action: "approve" | "reject";
  poUrl: string;
  decisionNote?: string;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildApprovalEmail(args: BuildApprovalEmailArgs): BuiltEmail {
  const { poNumber, action, poUrl, decisionNote } = args;
  const verb = action === "approve" ? "approved" : "rejected";
  const subject = `PO ${poNumber} ${verb}`;

  const noteLine =
    action === "reject" && decisionNote
      ? `\n\nReason: ${decisionNote}`
      : "";

  const text = `Your purchase order ${poNumber} was ${verb}.${noteLine}\n\nView it: ${poUrl}`;

  const noteHtml =
    action === "reject" && decisionNote
      ? `<p><strong>Reason:</strong> ${escapeHtml(decisionNote)}</p>`
      : "";

  const html = `<p>Your purchase order <strong>${escapeHtml(
    poNumber,
  )}</strong> was <strong>${verb}</strong>.</p>
${noteHtml}<p><a href="${poUrl}">View purchase order</a></p>`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
