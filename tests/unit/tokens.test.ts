import { describe, it, expect } from "vitest";
import {
  generateInviteToken,
  hashInviteToken,
  isInviteExpired,
} from "@/lib/auth/tokens";

describe("invite tokens", () => {
  it("generates URL-safe random tokens of decent length", () => {
    const t = generateInviteToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(32);
  });

  it("hashInviteToken is deterministic sha256 hex", () => {
    const h1 = hashInviteToken("hello");
    const h2 = hashInviteToken("hello");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken("hello1")).not.toBe(h1);
  });

  it("isInviteExpired works with past and future dates", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isInviteExpired(past)).toBe(true);
    expect(isInviteExpired(future)).toBe(false);
  });
});
