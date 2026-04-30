/**
 * Centavo helpers (ADR-4). Local copy; will be deduped post-merge with
 * src/lib/money.ts (added by issue #3).
 */

export function lineTotalCentavos(qty: number, unitPriceCentavos: number): number {
  if (!Number.isFinite(qty) || qty < 0) throw new Error("qty must be >= 0");
  if (!Number.isInteger(unitPriceCentavos) || unitPriceCentavos < 0)
    throw new Error("unit_price_centavos must be a non-negative integer");
  // qty may have up to 3 decimals; round to nearest centavo.
  return Math.round(qty * unitPriceCentavos);
}

export function sumCentavos(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function centavosToPeso(c: number): string {
  const sign = c < 0 ? "-" : "";
  const abs = Math.abs(c);
  const pesos = Math.floor(abs / 100);
  const cents = abs % 100;
  return `${sign}₱${pesos.toLocaleString("en-PH")}.${cents.toString().padStart(2, "0")}`;
}
