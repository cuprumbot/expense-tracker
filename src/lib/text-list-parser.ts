import defaultCatalog from "@/data/merchant-catalog.json";
import {
  convertUsdToGtq,
  getExchangeRate,
  isDollarCurrency,
  parseCurrency,
} from "@/lib/currency";
import { MerchantCatalog, normalizeText } from "@/lib/expense-classifier";
import { CSVParsingSummary, Transaction } from "@/types/transaction";

export interface SimpleListParsingSummary extends CSVParsingSummary {
  validTransactionsCount: number;
  skippedLinesCount: number;
  skippedLines: string[];
  totalAmount: number;
}

export interface SimpleListParsingResult {
  success: boolean;
  transactions: Transaction[];
  summary: SimpleListParsingSummary;
  error?: string;
}

interface CandidateExtraction {
  position: "leading" | "trailing";
  description: string;
  rawAmountStr: string;
  amount: number;
  currencyToken?: string;
  hasExplicitCurrency: boolean;
  hasDecimals: boolean;
}

/**
 * Brands that legitimately begin with a number (e.g., "7 Eleven", "24 Horas", "100 Montaditos").
 * Used to disambiguate lines like "7 eleven 45" where the leading number is part of the vendor name.
 */
const LEADING_NUMERIC_BRAND_PATTERNS: RegExp[] = [
  /^7\s*eleven\b/i,
  /^24\s*horas\b/i,
  /^24\s*\/\s*7\b/i,
  /^100\s*montaditos\b/i,
  /^360\b/i,
  /^5b\b/i,
];

/**
 * Common Guatemalan merchant/location suffix patterns where a trailing number is part of the vendor name.
 * Used alongside `merchant-catalog.json` to disambiguate lines like "40 super 24" or "120 La Torre Zona 10".
 */
const TRAILING_NUMERIC_MERCHANT_PATTERNS: RegExp[] = [
  /\bsuper\s*24$/i,
  /\bforever\s*21$/i,
  /\b(?:zona|zn|ruta|calle|avenida|av|km|local|sucursal|tienda|agencia|bodega)\s*\d+$/i,
];

/**
 * Returns today's date formatted as `YYYY-MM-DD` in local time.
 */
export function getLocalTodayDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Validates and normalizes an optional date string into `YYYY-MM-DD`, falling back to today's local date.
 */
function resolveUploadDate(uploadDate?: string): string {
  if (uploadDate && /^\d{4}-\d{2}-\d{2}$/.test(uploadDate.trim())) {
    return uploadDate.trim();
  }
  return getLocalTodayDateString();
}

/**
 * Strips leading/trailing punctuation separators (dashes, colons, bullets) from a merchant description.
 */
function cleanMerchantDescription(rawDescription: string): string {
  return rawDescription
    .replace(/^[-:–—•*]+\s*/, "")
    .replace(/\s*[-:–—•*]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts a candidate transaction assuming the amount is at the beginning of the line
 * (e.g., "150 Burger king", "40 super 24", "Q 50 Taco bell", "$15 Netflix").
 */
function extractLeadingCandidate(line: string): CandidateExtraction | null {
  const leadingRegex =
    /^(?:(Q|GTQ|\$|USD)\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?:\s*(Q|GTQ|\$|USD)(?=\s))?\s+(.+)$/i;
  const match = line.match(leadingRegex);
  if (!match) return null;

  const prefixCurrency = match[1];
  const integerPart = match[2];
  const decimalPart = match[3];
  const suffixCurrency = match[4];
  const rawDesc = match[5];

  const description = cleanMerchantDescription(rawDesc);
  if (!description || !/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(description)) {
    return null;
  }

  const rawAmountStr = decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
  const amount = parseCurrency(rawAmountStr);
  if (amount <= 0) return null;

  const currencyToken = prefixCurrency || suffixCurrency;

  return {
    position: "leading",
    description,
    rawAmountStr,
    amount,
    currencyToken,
    hasExplicitCurrency: Boolean(currencyToken),
    hasDecimals: Boolean(decimalPart),
  };
}

/**
 * Extracts a candidate transaction assuming the amount is at the end of the line
 * (e.g., "Walmart 150", "super 24 20", "Cemaco Q 200.50").
 */
function extractTrailingCandidate(line: string): CandidateExtraction | null {
  // Match the earliest rightmost amount token anchored at the end of the line
  const trailingAmountRegex =
    /\s+(?:(Q|GTQ|\$|USD)\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?:\s*(Q|GTQ|\$|USD))?$/i;
  const match = trailingAmountRegex.exec(line);
  if (!match || match.index <= 0) return null;

  const prefixCurrency = match[1];
  const integerPart = match[2];
  const decimalPart = match[3];
  const suffixCurrency = match[4];
  const rawDesc = line.slice(0, match.index);

  const description = cleanMerchantDescription(rawDesc);
  if (!description || !/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(description)) {
    return null;
  }

  const rawAmountStr = decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
  const amount = parseCurrency(rawAmountStr);
  if (amount <= 0) return null;

  const currencyToken = prefixCurrency || suffixCurrency;

  return {
    position: "trailing",
    description,
    rawAmountStr,
    amount,
    currencyToken,
    hasExplicitCurrency: Boolean(currencyToken),
    hasDecimals: Boolean(decimalPart),
  };
}

/**
 * Collects all normalized keywords from the merchant catalog that include digits (e.g., "super 24", "forever 21").
 */
function getNumericCatalogKeywords(catalog: MerchantCatalog): string[] {
  const numericKeywords: string[] = [];
  for (const cat of catalog.categories) {
    for (const kw of cat.keywords) {
      const normalized = normalizeText(kw);
      if (/\d/.test(normalized)) {
        numericKeywords.push(normalized);
      }
    }
  }
  return numericKeywords;
}

/**
 * Scores a candidate when a line starts AND ends with a number (e.g., "40 super 24" vs "7 eleven 45").
 * Uses catalog awareness and positional context to determine which number belongs to the vendor name
 * and which number is the monetary amount.
 */
function scoreCandidate(
  candidate: CandidateExtraction,
  other: CandidateExtraction,
  numericCatalogKeywords: string[]
): number {
  let score = 0;

  // 1. Explicit currency marker (Q, GTQ, $, USD) or decimals strongly identifies the true amount
  if (candidate.hasExplicitCurrency) score += 100;
  if (candidate.hasDecimals) score += 80;

  const normDesc = normalizeText(candidate.description);
  const normOtherDesc = normalizeText(other.description);

  // 2. Check if this candidate's description preserves a numeric merchant keyword from the catalog
  // (e.g. "super 24" in "40 super 24" or "7 eleven" in "7 eleven 45")
  for (const numKw of numericCatalogKeywords) {
    const regex = new RegExp(`(?:^|\\s)${numKw}(?:\\s|$)`);
    if (regex.test(normDesc) && !regex.test(normOtherDesc)) {
      score += 90;
      break;
    }
  }

  // 3. Check known numeric brand/suffix patterns
  if (candidate.position === "leading") {
    // In leading position, description is `<middle> <trailingNumber>` (e.g. "super 24", "La Torre Zona 10")
    if (TRAILING_NUMERIC_MERCHANT_PATTERNS.some((pattern) => pattern.test(candidate.description))) {
      score += 70;
    }
    // Natural Spanish merchant + number structure: starts with letters, ends with a number
    if (/^[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(candidate.description)) {
      score += 25;
    }
  } else {
    // In trailing position, description is `<leadingNumber> <middle>` (e.g. "7 eleven", "40 super")
    if (LEADING_NUMERIC_BRAND_PATTERNS.some((pattern) => pattern.test(candidate.description))) {
      score += 85;
    }
  }

  return score;
}

/**
 * Parses a single line from a simple expense list into a canonical `Transaction`,
 * or returns `null` if the line cannot be parsed as a valid expense entry.
 */
export function parseSimpleExpenseLine(
  rawLine: string,
  defaultDate: string,
  activeExchangeRate: number = getExchangeRate(),
  lineIndex: number = 0,
  catalog: MerchantCatalog = defaultCatalog as MerchantCatalog
): Transaction | null {
  if (!rawLine || typeof rawLine !== "string") return null;

  // Strip surrounding whitespace and optional list bullets
  let line = rawLine.trim().replace(/^[-*•]\s+/, "").trim();
  if (!line) return null;

  // Optional leading ISO date (YYYY-MM-DD) or DD/MM/YYYY
  let transactionDate = defaultDate;
  const isoDateMatch = line.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
  if (isoDateMatch) {
    transactionDate = isoDateMatch[1];
    line = isoDateMatch[2].trim();
  } else {
    const latamDateMatch = line.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(.+)$/);
    if (latamDateMatch) {
      const day = latamDateMatch[1].padStart(2, "0");
      const month = latamDateMatch[2].padStart(2, "0");
      const year = latamDateMatch[3];
      transactionDate = `${year}-${month}-${day}`;
      line = latamDateMatch[4].trim();
    }
  }

  const leadingCandidate = extractLeadingCandidate(line);
  const trailingCandidate = extractTrailingCandidate(line);

  if (!leadingCandidate && !trailingCandidate) {
    return null;
  }

  let chosen: CandidateExtraction;
  if (leadingCandidate && !trailingCandidate) {
    chosen = leadingCandidate;
  } else if (!leadingCandidate && trailingCandidate) {
    chosen = trailingCandidate;
  } else {
    const numericKeywords = getNumericCatalogKeywords(catalog);
    const leadingScore = scoreCandidate(leadingCandidate!, trailingCandidate!, numericKeywords);
    const trailingScore = scoreCandidate(trailingCandidate!, leadingCandidate!, numericKeywords);

    chosen = leadingScore >= trailingScore ? leadingCandidate! : trailingCandidate!;
  }

  const isUsd = isDollarCurrency(chosen.currencyToken);
  const finalAmount = isUsd
    ? convertUsdToGtq(chosen.amount, activeExchangeRate)
    : Math.round(chosen.amount * 100) / 100;

  if (finalAmount <= 0) {
    return null;
  }

  const tx: Transaction = {
    id: `list-${Date.now()}-${lineIndex + 1}`,
    date: transactionDate,
    description: chosen.description,
    amount: finalAmount,
    currency: "GTQ",
    ...(isUsd
      ? {
          originalCurrency: "USD" as const,
          originalAmount: chosen.amount,
          exchangeRateApplied: activeExchangeRate,
        }
      : {}),
  };

  return tx;
}

/**
 * Parses a multi-line simple expense list into canonical `Transaction[]` objects and a summary.
 *
 * Examples supported:
 * - `"Walmart 150"` -> `{ description: "Walmart", amount: 150, currency: "GTQ" }`
 * - `"150 Burger king"` -> `{ description: "Burger king", amount: 150, currency: "GTQ" }`
 * - `"40 super 24"` -> `{ description: "super 24", amount: 40, currency: "GTQ" }`
 * - `"super 24 20"` -> `{ description: "super 24", amount: 20, currency: "GTQ" }`
 */
export function parseSimpleExpenseList(
  rawText: string,
  uploadDate?: string,
  exchangeRate?: number,
  catalog: MerchantCatalog = defaultCatalog as MerchantCatalog
): SimpleListParsingResult {
  const resolvedDate = resolveUploadDate(uploadDate);
  const activeRate =
    typeof exchangeRate === "number" && !Number.isNaN(exchangeRate) && exchangeRate > 0
      ? exchangeRate
      : getExchangeRate();

  if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
    return {
      success: false,
      transactions: [],
      summary: {
        totalRowsProcessed: 0,
        validTransactionsCount: 0,
        skippedRowsCount: 0,
        skippedLinesCount: 0,
        skippedLines: [],
        totalAmount: 0,
      },
      error: "La lista de gastos está vacía. Ingresa al menos un gasto (por ejemplo: Walmart 150).",
    };
  }

  const rawLines = rawText.split(/\r?\n/);
  const transactions: Transaction[] = [];
  const skippedLines: string[] = [];
  let nonEmptyLinesCount = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      // Ignore blank lines
      continue;
    }

    nonEmptyLinesCount++;
    const parsedTx = parseSimpleExpenseLine(line, resolvedDate, activeRate, i, catalog);
    if (parsedTx) {
      transactions.push(parsedTx);
    } else {
      skippedLines.push(rawLines[i].trim());
    }
  }

  const totalAmount =
    Math.round(transactions.reduce((sum, tx) => sum + tx.amount, 0) * 100) / 100;

  if (transactions.length === 0) {
    return {
      success: false,
      transactions: [],
      summary: {
        totalRowsProcessed: nonEmptyLinesCount,
        validTransactionsCount: 0,
        skippedRowsCount: skippedLines.length,
        skippedLinesCount: skippedLines.length,
        skippedLines,
        totalAmount: 0,
      },
      error:
        "No se encontraron gastos válidos en el texto ingresado. Asegúrate de incluir el comercio y el monto en cada línea (por ejemplo: Walmart 150).",
    };
  }

  return {
    success: true,
    transactions,
    summary: {
      totalRowsProcessed: nonEmptyLinesCount,
      validTransactionsCount: transactions.length,
      skippedRowsCount: skippedLines.length,
      skippedLinesCount: skippedLines.length,
      skippedLines,
      totalAmount,
    },
  };
}

