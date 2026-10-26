import { createRequire } from "module";
import { parseCurrency, convertUsdToGtq, getExchangeRate } from "@/lib/currency";
import { Transaction, CSVParsingSummary } from "@/types/transaction";
import type { PDFParserInstance, PDFDebugLog } from "@/lib/pdf-parser";

/**
 * Normalizes date formatted as DD-MM-YYYY or DD-MMM-YYYY to ISO YYYY-MM-DD.
 */
export function normalizeStatementDate(dateStr: string): string {
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
 * Cleans raw Banco G&T Continental transaction description.
 * Strips appended address info after backslash and removes trailing country tokens.
 */
export function cleanGyTDescription(rawDesc: string): string {
  if (!rawDesc) return "";
  let desc = rawDesc;

  // Many GT POS transactions append \ADDRESS GTM, take the primary merchant name
  if (desc.includes("\\")) {
    desc = desc.split("\\")[0];
  }

  // Remove trailing GTM / GUA / GT tokens if remaining
  desc = desc.replace(/\s+(GTM|GUA|GT)$/i, "");

  return desc.trim();
}

/**
 * Backward compatibility alias for cleanGyTDescription.
 */
export const cleanMerchantDescription = cleanGyTDescription;

/**
 * Checks if a line in a Banco G&T Continental statement is a credit, payment, refund, subtotal, or non-expense record.
 */
export function isNonExpenseGyTLine(description: string): boolean {
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
 * Backward compatibility alias for isNonExpenseGyTLine.
 */
export const isNonExpenseLine = isNonExpenseGyTLine;

/**
 * Parses Banco G&T Continental statement plain text into canonical Transactions.
 * Used for text-based payloads and unit testing. Handles both Quetzales (Q) and US Dollars ($).
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
    if (isNonExpenseGyTLine(rawDesc)) {
      skippedRowsCount++;
      return;
    }

    const cleanDesc = cleanGyTDescription(rawDesc);
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
 * Coordinate-aware extraction from an already loaded PDF parser instance for Banco G&T Continental.
 * Differentiates 'Débito / Compras' (Q or $ at x < 460) from 'Crédito / Pagos' (Q at x >= 460),
 * and handles foreign currency ($) conversion to GTQ.
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

      const cleanDesc = cleanGyTDescription(rawDesc);
      if (!cleanDesc || isNonExpenseGyTLine(rawDesc)) {
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
  const require = createRequire(import.meta.url);
  const { PDFParse } = require("pdf-parse");

  const parser = new PDFParse(new Uint8Array(dataBuffer));
  await parser.load();
  return extractGyTTransactionsFromParser(parser);
}

/**
 * Standardized function alias for US-017 dispatcher.
 */
export const parseGyTStatement = parseGyTStatementFromBuffer;
