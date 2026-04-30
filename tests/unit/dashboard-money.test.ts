import { describe, it, expect } from "vitest";
import { computePercentUsed } from "@/lib/dashboard/percent";

describe("computePercentUsed", () => {
  it("returns 0 when budget is 0 (not NaN/Infinity)", () => {
    const v = computePercentUsed(1234, 0);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBe(0);
  });

  it("returns 0 when budget is null/undefined", () => {
    expect(computePercentUsed(100, null)).toBe(0);
    expect(computePercentUsed(100, undefined)).toBe(0);
  });

  it("returns 0 when spend is null/undefined", () => {
    expect(computePercentUsed(null, 1000)).toBe(0);
    expect(computePercentUsed(undefined, 1000)).toBe(0);
  });

  it("computes percent normally", () => {
    expect(computePercentUsed(2500, 10000)).toBe(25);
  });

  it("can exceed 100 (over budget)", () => {
    expect(computePercentUsed(15000, 10000)).toBe(150);
  });
});
