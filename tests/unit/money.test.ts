import { describe, it, expect } from "vitest";
import { centavosToPeso, pesoToCentavos } from "@/lib/money";

describe("centavosToPeso", () => {
  it("formats zero", () => {
    expect(centavosToPeso(0n)).toBe("0.00");
  });

  it("pads single-digit fraction", () => {
    expect(centavosToPeso(5n)).toBe("0.05");
    expect(centavosToPeso(50n)).toBe("0.50");
  });

  it("formats whole pesos", () => {
    expect(centavosToPeso(100n)).toBe("1.00");
    expect(centavosToPeso(12345n)).toBe("123.45");
  });

  it("supports negatives", () => {
    expect(centavosToPeso(-1n)).toBe("-0.01");
    expect(centavosToPeso(-12345n)).toBe("-123.45");
  });

  it("handles very large bigints without precision loss", () => {
    const big = 9_999_999_999_999_99n; // 9_999_999_999_999.99 pesos
    expect(centavosToPeso(big)).toBe("9999999999999.99");
  });
});

describe("pesoToCentavos", () => {
  it("parses zero forms", () => {
    expect(pesoToCentavos("0")).toBe(0n);
    expect(pesoToCentavos("0.00")).toBe(0n);
    expect(pesoToCentavos("0.0")).toBe(0n);
  });

  it("parses whole and fractional pesos", () => {
    expect(pesoToCentavos("1")).toBe(100n);
    expect(pesoToCentavos("1.5")).toBe(150n);
    expect(pesoToCentavos("1.50")).toBe(150n);
    expect(pesoToCentavos("123.45")).toBe(12345n);
  });

  it("strips currency symbol, whitespace, and commas", () => {
    expect(pesoToCentavos("₱1,234.50")).toBe(123450n);
    expect(pesoToCentavos("  ₱ 1,000  ")).toBe(100000n);
  });

  it("supports negatives", () => {
    expect(pesoToCentavos("-0.01")).toBe(-1n);
    expect(pesoToCentavos("-123.45")).toBe(-12345n);
  });

  it("rejects invalid input", () => {
    expect(() => pesoToCentavos("")).toThrow();
    expect(() => pesoToCentavos("abc")).toThrow();
    expect(() => pesoToCentavos("1.234")).toThrow();
    expect(() => pesoToCentavos("1.2.3")).toThrow();
    expect(() => pesoToCentavos("--1")).toThrow();
  });

  it("round-trips", () => {
    const samples = [
      0n,
      1n,
      99n,
      100n,
      12345n,
      -12345n,
      9_999_999_999_999_99n,
    ];
    for (const c of samples) {
      expect(pesoToCentavos(centavosToPeso(c))).toBe(c);
    }
  });
});
