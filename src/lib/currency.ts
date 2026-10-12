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
