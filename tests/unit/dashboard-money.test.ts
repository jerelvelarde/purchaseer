import { describe, it, expect } from "vitest";
import { computePercentUsed, centavosToPeso } from "@/lib/dashboard/money";

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

describe("centavosToPeso", () => {
  it("formats centavos as PHP currency", () => {
    const s = centavosToPeso(123456);
    // Locale formatting may differ across environments; just assert it
    // contains the numeric chunk and a currency marker.
    expect(s).toMatch(/1,234\.56/);
  });

  it("treats null/undefined/NaN as 0", () => {
    expect(centavosToPeso(null)).toMatch(/0\.00/);
    expect(centavosToPeso(undefined)).toMatch(/0\.00/);
    expect(centavosToPeso(NaN)).toMatch(/0\.00/);
  });
});
