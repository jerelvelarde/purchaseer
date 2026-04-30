/**
 * Local fallback for centavos -> peso formatting.
 *
 * Issue #3 is expected to add a shared `src/lib/money.ts`. Until that lands
 * we keep a tiny duplicate here to avoid a hard cross-PR dependency. The
 * post-merge cleanup is to import from `@/lib/money` and delete this file.
 */
export function centavosToPeso(centavos: number | null | undefined): string {
  const n = typeof centavos === "number" && Number.isFinite(centavos) ? centavos : 0;
  const pesos = n / 100;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos);
}

/**
 * Compute a percent-used value clamped sensibly. Returns 0 when the budget is
 * 0 or invalid (rather than NaN/Infinity).
 */
export function computePercentUsed(
  spendCentavos: number | null | undefined,
  budgetCentavos: number | null | undefined,
): number {
  const spend = typeof spendCentavos === "number" && Number.isFinite(spendCentavos) ? spendCentavos : 0;
  const budget = typeof budgetCentavos === "number" && Number.isFinite(budgetCentavos) ? budgetCentavos : 0;
  if (budget <= 0) return 0;
  return (spend / budget) * 100;
}
