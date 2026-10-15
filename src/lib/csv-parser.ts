import Papa from "papaparse";
import {
  parseCurrency,
  convertUsdToGtq,
  getExchangeRate,
  isDollarCurrency,
} from "@/lib/currency";
import {
  Transaction,
  CSVColumnMapping,
  CSVParsingResult,
  CSVParsingSummary,
} from "@/types/transaction";

const DATE_KEYWORDS = [
  "fecha",
  "date",
  "dia",
  "f.operacion",
  "f.valor",
  "f_operacion",
  "f_valor",
  "trans_date",
  "posting_date",
];

const DESCRIPTION_KEYWORDS = [
  "descripcion",
  "concepto",
  "description",
  "detalle",
  "comercio",
  "establecimiento",
  "movimiento",
  "texto movimiento",
  "merchant",
  "memo",
];

const AMOUNT_KEYWORDS = [
  "monto",
  "importe",
  "debito",
  "amount",
  "cargo",
  "total",
  "valor",
  "gasto",
  "cargo q",
  "debito q",
];

const CURRENCY_KEYWORDS = [
  "moneda",
  "currency",
  "tipo_moneda",
  "divisa",
  "tipo moneda",
  "tipo de moneda",
  "curr",
];

/**
 * Normalizes text for keyword comparison (lowercase, trims, removes diacritics).
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Finds candidate headers that match a set of keyword patterns.
 */
function findCandidateColumns(headers: string[], keywords: string[]): string[] {
  return headers.filter((header) => {
    const normalized = normalizeHeader(header);
    return keywords.some((kw) => {
      return (
        normalized === kw ||
        normalized.startsWith(kw + " ") ||
        normalized.endsWith(" " + kw) ||
        normalized.includes(kw)
      );
    });
  });
}

/**
 * Automatically detects whether column mapping is obvious or ambiguous.
 */
export function detectColumnMapping(headers: string[]): {
  isAmbiguous: boolean;
  ambiguityReason?: string;
  detected: Partial<CSVColumnMapping>;
} {
  const dateCandidates = findCandidateColumns(headers, DATE_KEYWORDS);
  const descCandidates = findCandidateColumns(headers, DESCRIPTION_KEYWORDS);
  const amountCandidates = findCandidateColumns(headers, AMOUNT_KEYWORDS);
  const currencyCandidates = findCandidateColumns(headers, CURRENCY_KEYWORDS);

  const detected: Partial<CSVColumnMapping> = {
    dateColumn: dateCandidates.length === 1 ? dateCandidates[0] : undefined,
    descriptionColumn: descCandidates.length === 1 ? descCandidates[0] : undefined,
    amountColumn: amountCandidates.length === 1 ? amountCandidates[0] : undefined,
    currencyColumn: currencyCandidates.length === 1 ? currencyCandidates[0] : undefined,
  };

  const reasons: string[] = [];

  if (dateCandidates.length === 0) {
    reasons.push("No se identificó automáticamente una columna de Fecha.");
  } else if (dateCandidates.length > 1) {
    reasons.push(
      `Múltiples columnas posibles para Fecha (${dateCandidates.join(", ")}).`
    );
  }

  if (descCandidates.length === 0) {
    reasons.push("No se identificó automáticamente una columna de Descripción.");
  } else if (descCandidates.length > 1) {
    reasons.push(
      `Múltiples columnas posibles para Descripción (${descCandidates.join(", ")}).`
    );
  }

  if (amountCandidates.length === 0) {
    reasons.push("No se identificó automáticamente una columna de Monto.");
  } else if (amountCandidates.length > 1) {
    reasons.push(
      `Múltiples columnas posibles para Monto (${amountCandidates.join(", ")}).`
    );
  }

  const isAmbiguous =
    dateCandidates.length !== 1 ||
    descCandidates.length !== 1 ||
    amountCandidates.length !== 1;

  return {
    isAmbiguous,
    ambiguityReason: reasons.join(" "),
    detected,
  };
}

/**
 * Formats or normalizes raw dates into YYYY-MM-DD when possible.
 */
function normalizeDate(rawDate: string): string {
  if (!rawDate) return "2026-01-01";
  const trimmed = rawDate.trim();

  // If already YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // If DD/MM/YYYY or DD-MM-YYYY (standard Latin America format)
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return trimmed;
}

/**
 * Parses raw CSV text and normalizes valid records into canonical Transactions.
 */
export function parseCSVContent(
  csvText: string,
  forcedMapping?: CSVColumnMapping
): CSVParsingResult {
  if (!csvText || !csvText.trim()) {
    return {
      success: false,
      transactions: [],
      headers: [],
      rawRows: [],
      needsMapping: false,
      summary: {
        totalRowsProcessed: 0,
        validTransactionsCount: 0,
        skippedRowsCount: 0,
        totalAmount: 0,
      },
      error: "El archivo CSV está vacío.",
    };
  }

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors && parsed.errors.length > 0 && parsed.data.length === 0) {
    return {
      success: false,
      transactions: [],
      headers: [],
      rawRows: [],
      needsMapping: false,
      summary: {
        totalRowsProcessed: 0,
        validTransactionsCount: 0,
        skippedRowsCount: 0,
        totalAmount: 0,
      },
      error: `Error al leer CSV: ${parsed.errors[0].message}`,
    };
  }

  const headers = parsed.meta.fields || [];
  const rawRows = parsed.data;

  // Determine column mapping
  let mappingToUse: CSVColumnMapping | null = null;
  let needsMapping = false;
  let ambiguityReason: string | undefined;
  let detectedPartial: Partial<CSVColumnMapping> = {};

  if (forcedMapping) {
    mappingToUse = forcedMapping;
  } else {
    const detection = detectColumnMapping(headers);
    detectedPartial = detection.detected;
    if (detection.isAmbiguous) {
      needsMapping = true;
      ambiguityReason = detection.ambiguityReason;
    } else {
      mappingToUse = {
        dateColumn: detection.detected.dateColumn!,
        descriptionColumn: detection.detected.descriptionColumn!,
        amountColumn: detection.detected.amountColumn!,
        currencyColumn: detection.detected.currencyColumn,
      };
    }
  }

  // If mapping is required, return metadata and raw rows so modal can display them
  if (needsMapping || !mappingToUse) {
    return {
      success: true,
      transactions: [],
      headers,
      rawRows,
      needsMapping: true,
      detectedMapping: detectedPartial,
      ambiguityReason,
      summary: {
        totalRowsProcessed: rawRows.length,
        validTransactionsCount: 0,
        skippedRowsCount: 0,
        totalAmount: 0,
      },
    };
  }

  // Extract and normalize transactions
  const transactions: Transaction[] = [];
  let skippedRowsCount = 0;
  let totalAmount = 0;

  rawRows.forEach((row, index) => {
    const rawDate = row[mappingToUse!.dateColumn];
    const rawDesc = row[mappingToUse!.descriptionColumn];
    const rawAmount = row[mappingToUse!.amountColumn];
    const rawCurrency = mappingToUse?.currencyColumn
      ? row[mappingToUse.currencyColumn]
      : undefined;

    if (!rawDesc && !rawAmount && !rawDate) {
      skippedRowsCount++;
      return;
    }

    const description = (rawDesc || "").trim();
    const amountVal = parseCurrency(rawAmount || "");

    // Ignore records without description or with zero/invalid amounts
    if (!description || Number.isNaN(amountVal) || amountVal === 0) {
      skippedRowsCount++;
      return;
    }

    // Detect if currency is USD either via currency column or inline symbol/text in amount
    const isDollar =
      isDollarCurrency(rawCurrency) || isDollarCurrency(rawAmount);

    const rate = getExchangeRate();
    const finalAmount = isDollar ? convertUsdToGtq(amountVal, rate) : amountVal;
    const normalizedAmount = Math.abs(finalAmount);
    totalAmount += normalizedAmount;

    transactions.push({
      id: `tx_csv_${index + 1}_${Date.now()}`,
      date: normalizeDate(rawDate),
      description,
      amount: Number(normalizedAmount.toFixed(2)),
      currency: "GTQ",
      classificationSource: "local",
      category: null,
      ...(isDollar
        ? {
            originalCurrency: "USD" as const,
            originalAmount: Number(Math.abs(amountVal).toFixed(2)),
            exchangeRateApplied: rate,
          }
        : {
            originalCurrency: "GTQ" as const,
            originalAmount: Number(Math.abs(amountVal).toFixed(2)),
          }),
    });
  });

  const summary: CSVParsingSummary = {
    totalRowsProcessed: rawRows.length,
    validTransactionsCount: transactions.length,
    skippedRowsCount,
    totalAmount: Number(totalAmount.toFixed(2)),
  };

  return {
    success: true,
    transactions,
    headers,
    rawRows,
    needsMapping: false,
    summary,
  };
}
