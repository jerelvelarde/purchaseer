import { Resend } from "resend";

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

const DEFAULT_FROM = "purchaseer <onboarding@purchaseer.app>";

/**
 * Thin Resend wrapper. If `RESEND_API_KEY` is unset, logs the payload to
 * console so dev/test flows work without a real key.
 */
export async function sendEmail(args: SendEmailArgs): Promise<{ id: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = args.from ?? DEFAULT_FROM;

  if (!apiKey) {
    console.info("[email:dev]", {
      to: args.to,
      from,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
    return { id: null };
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    to: args.to,
    from,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });

  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }
  return { id: result.data?.id ?? null };
}

export function inviteEmail(opts: {
  workspaceName: string;
  acceptUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `You're invited to ${opts.workspaceName} on purchaseer`;
  const text = `You've been invited to join ${opts.workspaceName} on purchaseer.\n\nAccept your invite:\n${opts.acceptUrl}\n\nThis link expires in 7 days.`;
  const html = `<p>You've been invited to join <strong>${escapeHtml(opts.workspaceName)}</strong> on purchaseer.</p>
<p><a href="${opts.acceptUrl}">Accept your invite</a></p>
<p style="color:#666;font-size:12px">Or copy this link: ${opts.acceptUrl}</p>
<p style="color:#666;font-size:12px">This link expires in 7 days.</p>`;
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
