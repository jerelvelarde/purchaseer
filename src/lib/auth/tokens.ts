import { createHash, randomBytes } from "node:crypto";

/**
 * Generate a URL-safe random invite token.
 * Returns base64url so it can be embedded in a link without escaping.
 */
export function generateInviteToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Hash a raw invite token with sha256. Stored at rest; the raw token only
 * lives in the email we send to the invitee.
 */
export function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * True when the given expires_at is strictly in the future.
 */
export function isInviteExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  const exp = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return exp.getTime() <= now.getTime();
}
