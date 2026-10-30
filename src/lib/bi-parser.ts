import { Transaction, CSVParsingSummary } from "@/types/transaction";
import type { PDFParserInstance, PDFDebugLog } from "@/lib/pdf-parser";

const SPANISH_MONTHS: Record<string, string> = {
  enero: "01",
  ene: "01",
  jan: "01",
  febrero: "02",
  feb: "02",
  marzo: "03",
  mar: "03",
  abril: "04",
  abr: "04",
  apr: "04",
  mayo: "05",
  may: "05",
  junio: "06",
  jun: "06",
  julio: "07",
  jul: "07",
  agosto: "08",
  ago: "08",
  aug: "08",
  septiembre: "09",
  sep: "09",
  set: "09",
  octubre: "10",
  oct: "10",
  noviembre: "11",
  nov: "11",
  diciembre: "12",
  dic: "12",
  dec: "12",
};

/**
 * Extracts statement period (year and 2-digit month) from Banco Industrial statement text.
 * In BI statements, the header displays "MES/YY" (e.g. "ABRIL/25", "JUNIO/25") or "MES / YYYY".
 */
export function extractStatementPeriod(text: string): { year: string; month: string } {
  const periodMatch = text.match(/\b([a-zA-Z]+)\s*\/\s*(\d{2,4})\b/);
  if (periodMatch) {
    const monthKey = periodMatch[1].toLowerCase();
    if (SPANISH_MONTHS[monthKey]) {
      const month = SPANISH_MONTHS[monthKey];
      let year = periodMatch[2];
      if (year.length === 2) {
        year = `20${year}`;
      }
      return { year, month };
    }
  }

  // Fallback: look for date pattern DD/MM/YYYY or YYYY-MM-DD
  const dateMatch = text.match(/\b\d{1,2}\/(\d{2})\/(\d{4})\b/);
  if (dateMatch) {
    return { year: dateMatch[2], month: dateMatch[1] };
  }

  const isoMatch = text.match(/\b(\d{4})-(\d{2})-\d{2}\b/);
  if (isoMatch) {
    return { year: isoMatch[1], month: isoMatch[2] };
  }

  return { year: "2025", month: "01" };
}

/**
 * Cleans and normalizes Banco Industrial merchant/concept descriptions.
 * Removes internal terminal codes, POS identifiers, ATM codes, and country codes (e.g., GTM, GUA, GT).
 */
export function cleanBiDescription(rawDesc: string): string {
  if (!rawDesc) return "";
  let desc = rawDesc.trim();

  // Strip POS / Debit prefixes
  desc = desc.replace(/^NOTA\s+DEBITO\s+/i, "");
  desc = desc.replace(/^POS\s+BI\s+/i, "");
  desc = desc.replace(/^POS\s+/i, "");

  // If description contains address details after backslash, keep primary merchant name
  if (desc.includes("\\")) {
    desc = desc.split("\\")[0].trim();
  }

  // Strip trailing country codes (GTM, GUA, GT)
  desc = desc.replace(/\s+(GTM|GUA|GT)$/i, "");

  // Collapse multiple whitespace characters into single space
  desc = desc.replace(/\s{2,}/g, " ");

  return desc.trim() || rawDesc.trim();
}

/**
 * Identifies whether a line is a credit, payment, refund, or non-expense summary record.
 * Checking account deposit patterns (depósitos monetarios/ahorros) and check exceptions
 * have been decommissioned in US-064.
 */
export function isNonExpenseBiLine(description: string): boolean {
  const normalized = description.toLowerCase().trim();

  // Card or loan payments
  if (
    normalized.includes("pago por internet") ||
    normalized.includes("pago internet") ||
    normalized.includes("pago de tarjeta") ||
    normalized.includes("pago tarjeta") ||
    normalized.includes("pago contado") ||
    normalized.includes("pago agenc") ||
    normalized.includes("pago banca movil") ||
    normalized.includes("pago electronico")
  ) {
    return true;
  }

  // Credit refunds, cashback, and reversals
  if (
    normalized.includes("nota credito") ||
    normalized.includes("credito cash back") ||
    normalized.includes("credito p/cargos") ||
    normalized.includes("devolucion") ||
    normalized.includes("intereses ganados") ||
    normalized.includes("interes capitalizado")
  ) {
    return true;
  }

  // Balance summaries and tabular headers
  if (
    normalized.includes("saldo anterior") ||
    normalized.includes("saldo corte") ||
    normalized.includes("saldo al corte") ||
    normalized.includes("saldo total") ||
    normalized.includes("pago minimo") ||
    normalized.includes("credito disponible") ||
    normalized.includes("limite de credito") ||
    normalized.includes("sub - total") ||
    normalized.includes("sub-total") ||
    normalized.includes("total debitos") ||
    normalized.includes("total creditos") ||
    normalized.includes("resumen") ||
    normalized.includes("detalle estado de cuenta")
  ) {
    return true;
  }

  return false;
}

/**
 * Local extractor for Banco Industrial statements.
 * Legacy checking account table extraction patterns (6-column coordinate layout for monetario/ahorro)
 * were decommissioned in US-064 in preparation for the credit card parser (US-066).
 */
export async function extractBiTransactionsFromParser(
  parser: PDFParserInstance,
  rawText: string
): Promise<{
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
}> {
  return {
    transactions: [],
    summary: {
      totalRowsProcessed: 0,
      validTransactionsCount: 0,
      skippedRowsCount: 0,
      totalAmount: 0,
    },
    debugLogs: [],
  };
}

/**
 * Coordinate-aware parser for Banco Industrial statements directly from Uint8Array.
 */
export async function parseBiStatementFromBuffer(
  dataBuffer: Uint8Array
): Promise<{
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
}> {
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const { PDFParse } = require("pdf-parse");

  const parser = new PDFParse(new Uint8Array(dataBuffer));
  await parser.load();
  const textResult = await parser.getText();
  const rawText = typeof textResult === "string" ? textResult : (textResult.text || "");

  return extractBiTransactionsFromParser(parser, rawText);
}

/**
 * Text-based parser for Banco Industrial statements.
 * Legacy checking account 3-column / 2-column running balance patterns
 * were decommissioned in US-064.
 */
export function parseBiStatementText(text: string): {
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
} {
  return {
    transactions: [],
    summary: {
      totalRowsProcessed: 0,
      validTransactionsCount: 0,
      skippedRowsCount: 0,
      totalAmount: 0,
    },
    debugLogs: [],
  };
}
