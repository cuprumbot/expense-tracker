import { createRequire } from "module";
import { parseCurrency, convertUsdToGtq, getExchangeRate } from "@/lib/currency";
import { Transaction, CSVParsingSummary } from "@/types/transaction";
import { extractBiTransactionsFromParser } from "./bi-parser";

interface GlobalWithDOMPolyfills {
  DOMMatrix?: new () => unknown;
  ImageData?: new () => unknown;
  Path2D?: new () => unknown;
}

const customGlobal = globalThis as unknown as GlobalWithDOMPolyfills;
if (typeof customGlobal.DOMMatrix === "undefined") {
  customGlobal.DOMMatrix = class DOMMatrix {
    constructor() {}
  };
}
if (typeof customGlobal.ImageData === "undefined") {
  customGlobal.ImageData = class ImageData {};
}
if (typeof customGlobal.Path2D === "undefined") {
  customGlobal.Path2D = class Path2D {};
}

export interface PDFTextItem {
  str: string;
  transform: number[];
}

export interface PDFTextContent {
  items: PDFTextItem[];
}

export interface PDFPage {
  getTextContent(): Promise<PDFTextContent>;
}

export interface PDFDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPage>;
}

export interface PDFParserInstance {
  doc: PDFDocument;
  load(): Promise<void>;
  getText(): Promise<string | { text: string }>;
}

interface PDFParserConstructor {
  new (data: Uint8Array): PDFParserInstance;
}

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse") as {
  PDFParse: PDFParserConstructor;
};

export interface PDFDebugLog {
  type: "credit_or_payment" | "dollar_currency";
  date: string;
  description: string;
  amount: string;
}

export interface PDFParseResult {
  success: boolean;
  isSupportedBank: boolean;
  bankName: string;
  rawText: string;
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
  error?: string;
}

/**
 * Extracts plain text from a PDF Uint8Array buffer.
 */
export async function extractTextFromPDF(dataBuffer: Uint8Array): Promise<string> {
  const parser = new PDFParse(dataBuffer);
  await parser.load();
  const textResult = await parser.getText();
  return typeof textResult === "string" ? textResult : (textResult.text || "");
}

export interface BankDetectionResult {
  bankName: string;
  isSupported: boolean;
  isGyT: boolean;
  isBI: boolean;
  isBAM: boolean;
  isBanrural: boolean;
}

/**
 * Detects the originating bank of a statement based on header text, metadata, and keywords.
 * Identifies Banco Industrial, Banco G&T Continental, Banrural, and Banco Agromercantil (BAM).
 */
export function detectBankFromText(text: string): BankDetectionResult {
  const normalized = text.toLowerCase();

  const isGyT =
    normalized.includes("g&t continental") ||
    normalized.includes("gtc.com.gt") ||
    normalized.includes("plaza continental");

  const isBI =
    normalized.includes("banco industrial") ||
    normalized.includes("corporación bi") ||
    normalized.includes("corporacion bi") ||
    normalized.includes("bi en línea") ||
    normalized.includes("bi en linea") ||
    normalized.includes("bi.com.gt") ||
    normalized.includes("club bi") ||
    normalized.includes("bi-app") ||
    normalized.includes("serbipago") ||
    /\bgt\d{2}\s*indl\b/i.test(text);

  const isBAM =
    normalized.includes("banco agromercantil") ||
    normalized.includes("bam.com.gt") ||
    /\bbam\b/i.test(text);

  const isBanrural =
    normalized.includes("banrural") ||
    normalized.includes("banco de desarrollo rural") ||
    normalized.includes("banrural.com.gt");

  if (isBI) {
    return {
      bankName: "Banco Industrial",
      isSupported: true,
      isGyT: false,
      isBI: true,
      isBAM: false,
      isBanrural: false,
    };
  }

  if (isGyT) {
    return {
      bankName: "Banco G&T Continental",
      isSupported: true,
      isGyT: true,
      isBI: false,
      isBAM: false,
      isBanrural: false,
    };
  }

  if (isBanrural) {
    return {
      bankName: "Banrural",
      isSupported: false,
      isGyT: false,
      isBI: false,
      isBAM: false,
      isBanrural: true,
    };
  }

  if (isBAM) {
    return {
      bankName: "Banco Agromercantil (BAM)",
      isSupported: false,
      isGyT: false,
      isBI: false,
      isBAM: true,
      isBanrural: false,
    };
  }

  return {
    bankName: "Banco no identificado",
    isSupported: false,
    isGyT: false,
    isBI: false,
    isBAM: false,
    isBanrural: false,
  };
}

/**
 * Normalizes date formatted as DD-MM-YYYY or DD-MMM-YYYY to ISO YYYY-MM-DD.
 */
function normalizeStatementDate(dateStr: string): string {
  if (!dateStr) return "2026-01-01";
  const parts = dateStr.trim().split(/[-/.]/);
  if (parts.length !== 3) return dateStr;

  const day = parts[0].padStart(2, "0");
  let month = parts[1];
  const year = parts[2];

  // Handle letter months like OCT, AUG, SEP
  const MONTHS: Record<string, string> = {
    ene: "01", jan: "01",
    feb: "02",
    mar: "03",
    abr: "04", apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    ago: "08", aug: "08",
    sep: "09", set: "09",
    oct: "10",
    nov: "11",
    dic: "12", dec: "12",
  };

  const cleanMonth = month.toLowerCase();
  if (MONTHS[cleanMonth]) {
    month = MONTHS[cleanMonth];
  } else {
    month = month.padStart(2, "0");
  }

  return `${year}-${month}-${day}`;
}

/**
 * Cleans raw transaction description (e.g., strips appended address info after backslash).
 */
function cleanMerchantDescription(rawDesc: string): string {
  if (!rawDesc) return "";
  let desc = rawDesc;

  // Many GT POS transactions append \ADDRESS GTM, take the primary merchant name
  if (desc.includes("\\")) {
    desc = desc.split("\\")[0];
  }

  // Remove trailing GTM / GUA tokens if remaining
  desc = desc.replace(/\s+(GTM|GUA|GT)$/i, "");

  return desc.trim();
}

/**
 * Checks if a line is a credit, payment, refund, subtotal, or non-expense record.
 */
function isNonExpenseLine(description: string): boolean {
  const normalized = description.toLowerCase();

  // Payment lines
  if (
    normalized.includes("pago por internet") ||
    normalized.includes("pago internet") ||
    normalized.includes("pago de tarjeta") ||
    normalized.includes("pago contado")
  ) {
    return true;
  }

  // Cashback, credit refunds, bonificaciones
  if (
    normalized.includes("credito cash back") ||
    normalized.includes("credito p/cargos") ||
    normalized.startsWith("cr m ") ||
    normalized.startsWith("cr mw ")
  ) {
    return true;
  }

  // Subtotals and summaries
  if (
    normalized.includes("sub - total") ||
    normalized.includes("sub-total") ||
    normalized.includes("saldo anterior") ||
    normalized.includes("saldo total") ||
    normalized.includes("pago minimo")
  ) {
    return true;
  }

  return false;
}

/**
 * Parses G&T Continental statement plain text into canonical Transactions.
 * Used for text-based payloads and unit testing. Strictly extracts Quetzales (Q) expenses.
 */
export function parseGyTStatementText(text: string): {
  transactions: Transaction[];
  summary: CSVParsingSummary;
} {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const transactions: Transaction[] = [];
  let skippedRowsCount = 0;
  let totalAmount = 0;

  // Regex matching G&T Continental statement expense lines:
  // Date1 (Consumption) | Date2 (Posting) | Description | Q or $ | Amount
  const txLineRegex = /^(\d{2}[-/.]\d{2}[-/.]\d{4})\s+(\d{2}[-/.]\w{2,3}[-/.]\d{4}|\d{2}[-/.]\d{2}[-/.]\d{4})\s+(.+?)\s+([Q$])\s+([\d,]+\.\d{2})/;

  lines.forEach((line, index) => {
    const match = line.match(txLineRegex);
    if (!match) {
      return;
    }

    const [, rawDate, , rawDesc, currencySymbol, rawAmount] = match;

    // Filter non-expense lines (payments, credits, refunds, summaries)
    if (isNonExpenseLine(rawDesc)) {
      skippedRowsCount++;
      console.log(
        `[Depuración PDF - Entrada en Crédito/Pagos] Fecha: ${rawDate} | Descripción: ${rawDesc} | Monto: ${currencySymbol} ${rawAmount}`
      );
      return;
    }

    const cleanDesc = cleanMerchantDescription(rawDesc);
    const amountVal = parseCurrency(rawAmount);

    if (!cleanDesc || Number.isNaN(amountVal) || amountVal === 0) {
      skippedRowsCount++;
      return;
    }

    const isDollar = currencySymbol === "$";
    const rate = getExchangeRate();
    const finalAmount = isDollar ? convertUsdToGtq(amountVal, rate) : amountVal;
    const normalizedAmount = Math.abs(finalAmount);
    totalAmount += normalizedAmount;

    transactions.push({
      id: `tx_gyt_${index + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: normalizeStatementDate(rawDate),
      description: cleanDesc,
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
    totalRowsProcessed: transactions.length + skippedRowsCount,
    validTransactionsCount: transactions.length,
    skippedRowsCount,
    totalAmount: Number(totalAmount.toFixed(2)),
  };

  return { transactions, summary };
}

/**
 * Coordinate-aware extraction from an already loaded PDF parser.
 * Differentiates 'Débito / Compras' (Q at x < 460) from 'Crédito / Pagos' (Q at x >= 460),
 * and ignores transactions in foreign currency ($).
 */
export async function extractGyTTransactionsFromParser(
  parser: PDFParserInstance
): Promise<{
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
}> {
  const numPages = parser.doc.numPages;
  const transactions: Transaction[] = [];
  const debugLogs: PDFDebugLog[] = [];
  let skippedRowsCount = 0;
  let totalAmount = 0;

  for (let p = 1; p <= numPages; p++) {
    const page = await parser.doc.getPage(p);
    const content = await page.getTextContent();
    const linesByY = new Map<number, { str: string; x: number }[]>();

    for (const item of content.items) {
      if (!item.str || item.str.trim() === "") continue;
      const y = Math.round(item.transform[5]);
      let matchedY: number | null = null;
      for (const existingY of linesByY.keys()) {
        if (Math.abs(existingY - y) <= 2) {
          matchedY = existingY;
          break;
        }
      }
      const targetY = matchedY !== null ? matchedY : y;
      if (!linesByY.has(targetY)) linesByY.set(targetY, []);
      linesByY.get(targetY)!.push({ str: item.str, x: item.transform[4] });
    }

    for (const [, items] of linesByY.entries()) {
      items.sort((a, b) => a.x - b.x);
      const dateMatch = items[0]?.str.match(/^(\d{2}[-/.]\d{2}[-/.]\d{4})/);
      if (!dateMatch) continue;

      // Locate currency symbol: "Q" or "$"
      const currencyIndex = items.findIndex(
        (it) => it.str.trim() === "Q" || it.str.trim() === "$"
      );
      if (currencyIndex === -1) {
        skippedRowsCount++;
        continue;
      }

      const currencyItem = items[currencyIndex];
      const currencySymbol = currencyItem.str.trim();
      const isDollar = currencySymbol === "$";

      // Column separation in G&T layout:
      // Débito / Compras: currency symbol at x < 460 (centered around x ~ 401)
      // Crédito / Pagos: currency symbol at x >= 460 (centered around x ~ 505)
      const isDebit = currencyItem.x < 460;
      if (!isDebit) {
        // Payments, cashback, or statement credits -> ignore
        skippedRowsCount++;
        const descItems = items.slice(2, currencyIndex);
        const rawDesc =
          descItems.map((i) => i.str).join(" ").trim() ||
          items.slice(1, currencyIndex).map((i) => i.str).join(" ").trim();
        const creditAmountItem = items
          .slice(currencyIndex + 1)
          .find((it) => it.str.trim().match(/^[\d,]+\.\d{2}$/));
        const creditAmount = creditAmountItem ? creditAmountItem.str.trim() : "N/A";
        const debugLog: PDFDebugLog = {
          type: "credit_or_payment",
          date: dateMatch[1],
          description: rawDesc,
          amount: `${currencySymbol} ${creditAmount}`,
        };
        debugLogs.push(debugLog);
        console.log(
          `[Depuración PDF - Entrada en Crédito/Pagos] Fecha: ${dateMatch[1]} | Descripción: ${rawDesc} | Monto: ${currencySymbol} ${creditAmount}`
        );
        continue;
      }

      // Extract amount item following the currency symbol
      const amountItem = items
        .slice(currencyIndex + 1)
        .find((it) => it.str.trim().match(/^[\d,]+\.\d{2}$/));
      if (!amountItem) {
        skippedRowsCount++;
        continue;
      }

      const amountVal = parseFloat(amountItem.str.replace(/,/g, ""));
      if (Number.isNaN(amountVal) || amountVal <= 0) {
        skippedRowsCount++;
        continue;
      }

      // Description is everything between date2 and the currency symbol
      const descItems = items.slice(2, currencyIndex);
      let rawDesc = descItems.map((i) => i.str).join(" ").trim();
      if (!rawDesc) {
        rawDesc = items.slice(1, currencyIndex).map((i) => i.str).join(" ").trim();
      }

      const cleanDesc = cleanMerchantDescription(rawDesc);
      if (!cleanDesc || isNonExpenseLine(rawDesc)) {
        skippedRowsCount++;
        continue;
      }

      const isoDate = normalizeStatementDate(dateMatch[1]);
      const rate = getExchangeRate();
      const finalAmount = isDollar ? convertUsdToGtq(amountVal, rate) : amountVal;
      totalAmount += finalAmount;

      transactions.push({
        id: `tx_gyt_p${p}_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: isoDate,
        description: cleanDesc,
        amount: Number(finalAmount.toFixed(2)),
        currency: "GTQ",
        classificationSource: "local",
        category: null,
        ...(isDollar
          ? {
              originalCurrency: "USD" as const,
              originalAmount: Number(amountVal.toFixed(2)),
              exchangeRateApplied: rate,
            }
          : {
              originalCurrency: "GTQ" as const,
              originalAmount: Number(amountVal.toFixed(2)),
            }),
      });
    }
  }

  const summary: CSVParsingSummary = {
    totalRowsProcessed: transactions.length + skippedRowsCount,
    validTransactionsCount: transactions.length,
    skippedRowsCount,
    totalAmount: Number(totalAmount.toFixed(2)),
  };

  return { transactions, summary, debugLogs };
}

/**
 * Coordinate-aware parser for Banco G&T Continental statement PDFs from Uint8Array.
 */
export async function parseGyTStatementFromBuffer(
  dataBuffer: Uint8Array
): Promise<{
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
}> {
  const parser = new PDFParse(new Uint8Array(dataBuffer));
  await parser.load();
  return extractGyTTransactionsFromParser(parser);
}

/**
 * Top-level function to parse any uploaded PDF statement buffer.
 */
export async function parsePDFStatement(dataBuffer: Uint8Array): Promise<PDFParseResult> {
  try {
    const parser = new PDFParse(new Uint8Array(dataBuffer));
    await parser.load();
    const textResult = await parser.getText();
    const rawText = typeof textResult === "string" ? textResult : (textResult.text || "");
    const bankDetection = detectBankFromText(rawText);

    if (!bankDetection.isSupported) {
      return {
        success: true,
        isSupportedBank: false,
        bankName: bankDetection.bankName,
        rawText,
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

    if (bankDetection.isBI) {
      const parsed = await extractBiTransactionsFromParser(parser, rawText);
      return {
        success: true,
        isSupportedBank: true,
        bankName: "Banco Industrial",
        rawText,
        transactions: parsed.transactions,
        summary: parsed.summary,
        debugLogs: parsed.debugLogs,
      };
    }

    // Reuse the loaded parser for high-precision coordinate extraction for Banco G&T Continental
    const parsed = await extractGyTTransactionsFromParser(parser);

    return {
      success: true,
      isSupportedBank: true,
      bankName: "Banco G&T Continental",
      rawText,
      transactions: parsed.transactions,
      summary: parsed.summary,
      debugLogs: parsed.debugLogs,
    };
  } catch (err) {
    return {
      success: false,
      isSupportedBank: false,
      bankName: "Desconocido",
      rawText: "",
      transactions: [],
      summary: {
        totalRowsProcessed: 0,
        validTransactionsCount: 0,
        skippedRowsCount: 0,
        totalAmount: 0,
      },
      debugLogs: [],
      error: `Error al leer PDF: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export {
  extractBiTransactionsFromParser,
  parseBiStatementFromBuffer,
  parseBiStatementText,
  cleanBiDescription,
} from "./bi-parser";
