/**
 * Currency utilities for Guatemalan Quetzales (GTQ / Q).
 * Strictly complies with project formatting guidelines.
 */

/**
 * Formats a numeric amount to Guatemalan Quetzales string representation.
 * Example: 1500.5 -> "Q 1,500.50", -45 -> "-Q 45.00"
 *
 * @param amount - The numeric monetary value to format.
 * @returns Formatted currency string with the "Q" symbol.
 */
export function formatCurrency(amount: number): string {
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return "Q 0.00";
  }

  const isNegative = amount < 0;
  const absoluteAmount = Math.abs(amount);

  const parts = absoluteAmount.toFixed(2).split(".");
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimalPart = parts[1];

  const formattedNumber = `${integerPart}.${decimalPart}`;

  return isNegative ? `-Q ${formattedNumber}` : `Q ${formattedNumber}`;
}

/**
 * Parses a string representation of an amount into a number.
 * Strips out currency symbols (Q, GTQ), spaces, and thousand-separator commas.
 *
 * @param value - Raw text representing an amount (e.g. "Q 1,234.56", "(45.00)", "-15.20").
 * @returns Parsed number or NaN if invalid.
 */
export function parseCurrency(value: string | number): number {
  if (typeof value === "number") {
    return Number.isNaN(value) ? 0 : value;
  }

  if (!value || typeof value !== "string") {
    return 0;
  }

  let cleaned = value.trim();

  // Handle accounting negative format: (123.45) or leading minus: -Q 123.45 / Q -123.45
  const isParenthesesNegative = /^\(.*\)$/.test(cleaned);
  const isMinusNegative = cleaned.includes("-");
  const isNegative = isParenthesesNegative || isMinusNegative;

  // Remove currency identifiers, minus signs, parentheses, commas, and whitespace
  cleaned = cleaned
    .replace(/GTQ|Q/gi, "")
    .replace(/[(),\s-]/g, "");

  const parsed = parseFloat(cleaned);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return isNegative ? -Math.abs(parsed) : parsed;
}

/**
 * Default fallback exchange rate: USD 1.00 = GTQ 7.85.
 * Strictly conforms to project specifications in SPEC.md.
 */
export const DEFAULT_USD_TO_GTQ_RATE = 7.85;

/**
 * Retrieves the active USD to GTQ exchange rate.
 * Reads from the server environment variable `USD_GTQ_EXCHANGE_RATE`.
 * Gracefully falls back to 7.85 if the variable is unset, not a number, or less than or equal to zero.
 *
 * @returns Active exchange rate as a positive number.
 */
export function getExchangeRate(): number {
  const envVal =
    typeof process !== "undefined" && process.env
      ? process.env.USD_GTQ_EXCHANGE_RATE
      : undefined;

  if (envVal !== undefined && envVal !== null) {
    const parsed = parseFloat(String(envVal).trim());
    if (!Number.isNaN(parsed) && parsed > 0) {
      return Number(parsed.toFixed(4));
    }
  }

  return DEFAULT_USD_TO_GTQ_RATE;
}

/**
 * Converts a US Dollar (USD) monetary value to Guatemalan Quetzales (GTQ).
 * Multiplies by the system exchange rate (or customRate if provided and valid > 0)
 * and accurately rounds to 2 decimal places.
 *
 * @param amountInUsd - The monetary value in USD.
 * @param customRate - Optional custom exchange rate to override the system default.
 * @returns Converted amount in GTQ rounded to 2 decimal places.
 */
export function convertUsdToGtq(amountInUsd: number, customRate?: number): number {
  if (typeof amountInUsd !== "number" || Number.isNaN(amountInUsd)) {
    return 0;
  }

  if (amountInUsd === 0) {
    return 0;
  }

  let rate = getExchangeRate();
  if (
    typeof customRate === "number" &&
    !Number.isNaN(customRate) &&
    customRate > 0
  ) {
    rate = customRate;
  }

  const converted = amountInUsd * rate;
  // Accurately round to 2 decimal places
  const factor = 100;
  const isNegative = converted < 0;
  const rounded = Math.round(Math.abs(converted) * factor) / factor;

  return isNegative ? -rounded : rounded;
}
