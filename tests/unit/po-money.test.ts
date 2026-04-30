import { describe, it, expect } from "vitest";
import { lineTotalCentavos, sumCentavos, formatPeso } from "@/lib/money";

describe("PO money helpers", () => {
  it("lineTotalCentavos multiplies and rounds", () => {
    expect(lineTotalCentavos(2, 12345)).toBe(24690);
    expect(lineTotalCentavos(1.5, 100)).toBe(150);
    expect(lineTotalCentavos(0.333, 10000)).toBe(3330);
  });

  it("lineTotalCentavos rounds to nearest centavo", () => {
    // 0.1 * 333 = 33.3 → 33
    expect(lineTotalCentavos(0.1, 333)).toBe(33);
    // 0.5 * 333 = 166.5 → 167 (round half up via Math.round)
    expect(lineTotalCentavos(0.5, 333)).toBe(167);
  });

  it("rejects negatives", () => {
    expect(() => lineTotalCentavos(-1, 100)).toThrow();
    expect(() => lineTotalCentavos(1, -1)).toThrow();
  });

  it("sumCentavos", () => {
    expect(sumCentavos([])).toBe(0);
    expect(sumCentavos([100, 200, 50])).toBe(350);
  });

  it("formatPeso formats numbers and bigints", () => {
    expect(formatPeso(0)).toBe("₱0.00");
    expect(formatPeso(150)).toBe("₱1.50");
    expect(formatPeso(123456)).toBe("₱1,234.56");
    expect(formatPeso(-150)).toBe("-₱1.50");
    expect(formatPeso(150n)).toBe("₱1.50");
    expect(formatPeso(null)).toBe("₱0.00");
  });
});
