/**
 * Money helpers. ADR-4: amounts are stored as integer centavos (bigint) and
 * never converted to floats for math. Conversions to/from human-readable
 * pesos happen only at the UI/IO boundary.
 *
 * 1 peso = 100 centavos.
 */

const CENTAVOS_PER_PESO = 100n;

/**
 * Format a centavo amount as a peso string with 2 decimals.
 * Negative values are supported. No currency symbol — caller adds "₱".
 *
 * Examples:
 *   centavosToPeso(0n)        -> "0.00"
 *   centavosToPeso(150n)      -> "1.50"
 *   centavosToPeso(-12345n)   -> "-123.45"
 *   centavosToPeso(100000000000n) -> "1000000000.00"
 */
export function centavosToPeso(n: bigint): string {
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const whole = abs / CENTAVOS_PER_PESO;
  const frac = abs % CENTAVOS_PER_PESO;
  const fracStr = frac.toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fracStr}`;
}

/**
 * Parse a user-entered peso string into bigint centavos.
 * Accepts:
 *   - optional leading sign
 *   - optional ₱ or whitespace
 *   - thousands separators (",")
 *   - 0, 1, or 2 fractional digits
 *
 * Throws on invalid input. Always returns an integer number of centavos.
 *
 *   pesoToCentavos("0")        -> 0n
 *   pesoToCentavos("1.50")     -> 150n
 *   pesoToCentavos("₱1,234.5") -> 123450n
 *   pesoToCentavos("-0.01")    -> -1n
 */
export function pesoToCentavos(input: string): bigint {
  if (typeof input !== "string") {
    throw new TypeError("pesoToCentavos expects a string");
  }
  const cleaned = input.replace(/[₱\s,]/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "+") {
    throw new Error(`Invalid peso amount: ${JSON.stringify(input)}`);
  }
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) {
    throw new Error(`Invalid peso amount: ${JSON.stringify(input)}`);
  }
  const [, sign, whole, fracRaw = ""] = match;
  const frac = (fracRaw + "00").slice(0, 2);
  const total = BigInt(whole) * CENTAVOS_PER_PESO + BigInt(frac);
  return sign === "-" ? -total : total;
}

/**
 * Format centavos as a localized peso currency string with the ₱ symbol.
 * Accepts both `number` and `bigint` so it can sit at the boundary between
 * the storage layer (bigint) and JS code paths that use number.
 *
 *   formatPeso(0)          -> "₱0.00"
 *   formatPeso(150)        -> "₱1.50"
 *   formatPeso(123450n)    -> "₱1,234.50"
 *   formatPeso(-1)         -> "-₱0.01"
 */
export function formatPeso(centavos: number | bigint | null | undefined): string {
  const n =
    typeof centavos === "bigint"
      ? Number(centavos)
      : typeof centavos === "number" && Number.isFinite(centavos)
        ? centavos
        : 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n / 100);
}

/**
 * Compute a line total in centavos. `qty` may have decimals; the result is
 * rounded to the nearest centavo. `unitPriceCentavos` must be a non-negative
 * integer.
 */
export function lineTotalCentavos(qty: number, unitPriceCentavos: number): number {
  if (!Number.isFinite(qty) || qty < 0) throw new Error("qty must be >= 0");
  if (!Number.isInteger(unitPriceCentavos) || unitPriceCentavos < 0)
    throw new Error("unit_price_centavos must be a non-negative integer");
  return Math.round(qty * unitPriceCentavos);
}

/** Sum centavo values. Returns 0 for an empty list. */
export function sumCentavos(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
