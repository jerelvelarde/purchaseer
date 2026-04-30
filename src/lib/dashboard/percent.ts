/**
 * Compute a percent-used value clamped sensibly. Returns 0 when the budget
 * is 0 or invalid (rather than NaN/Infinity).
 */
export function computePercentUsed(
  spendCentavos: number | null | undefined,
  budgetCentavos: number | null | undefined,
): number {
  const spend =
    typeof spendCentavos === "number" && Number.isFinite(spendCentavos)
      ? spendCentavos
      : 0;
  const budget =
    typeof budgetCentavos === "number" && Number.isFinite(budgetCentavos)
      ? budgetCentavos
      : 0;
  if (budget <= 0) return 0;
  return (spend / budget) * 100;
}
