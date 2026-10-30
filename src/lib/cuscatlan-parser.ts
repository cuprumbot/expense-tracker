import { Transaction, CSVParsingSummary } from "@/types/transaction";
import { convertUsdToGtq, getExchangeRate } from "@/lib/currency";
import type { PDFParserInstance, PDFDebugLog } from "@/lib/pdf-parser";

/**
 * Cleans and normalizes Banco Cuscatlán merchant descriptions.
 * Strips authorization prefixes, fused location names (SAGUATEMALA, MAJADASGUATEMALA),
 * city and country repetitions, and trailing entity types.
 */
export function cleanCuscatlanDescription(rawDesc: string): string {
  if (!rawDesc) return "";
  let desc = rawDesc.trim();

  // Strip POS / COMPRA prefixes
  desc = desc.replace(/^(COMPRA\s+POS|POS\s+CUSCATLAN|POS\s+BI|POS|COMPRA)\s+/i, "");

  // Separate fused SA + location (e.g. SAGUATEMALA -> SA GUATEMALA)
  desc = desc.replace(/SAGUATEMALA/gi, "SA GUATEMALA");

  // Separate fused words ending in GUATEMALA (e.g. MAJADASGUATEMALA -> MAJADAS GUATEMALA)
  desc = desc.replace(/([A-Z]{3,})GUATEMALA/g, (_m, p) => p + " GUATEMALA");

  // Strip trailing country markers (e.g. GTM, GUA, GT)
  desc = desc.replace(/\s+(GTM|GUA|GT)$/i, "");

  // Strip trailing city / country markers (e.g. GUATEMALA GUATEMALA, GUATEMALA)
  desc = desc.replace(/\s+GUATEMALA(\s+GUATEMALA)?$/i, "");

  // Strip trailing country markers again in case GUATEMALA preceded country code (e.g. GUATEMALA GT)
  desc = desc.replace(/\s+(GTM|GUA|GT)$/i, "");

  // Strip trailing corporate suffixes (e.g. S.A., SA, LTDA)
  desc = desc.replace(/\s+S\.?A\.?$/i, "");

  // Collapse multiple whitespace characters into single space
  desc = desc.replace(/\s{2,}/g, " ");

  return desc.trim() || rawDesc.trim();
}

/**
 * Normalizes a Cuscatlán date string (e.g., "16/09/2026" or "16-09-2026") into ISO "YYYY-MM-DD".
 */
export function normalizeCuscatlanDate(dateStr: string): string | null {
  const match = dateStr.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!match) return null;

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  let year = match[3];
  if (year.length === 2) {
    year = `20${year}`;
  }

  return `${year}-${month}-${day}`;
}

/**
 * Determines whether a description or line text corresponds to a payment, credit,
 * cashback, reward, or non-expense statement summary.
 */
export function isNonExpenseCuscatlanLine(desc: string): boolean {
  const norm = desc.toLowerCase().trim();

  // Payments to the card
  if (
    norm.startsWith("pago") ||
    norm.includes("su pago") ||
    norm.includes("pago tc") ||
    norm.includes("pago electronico") ||
    norm.includes("pago en sucursal") ||
    norm.includes("pago por internet") ||
    norm.includes("abono a tarjeta") ||
    norm.includes("abono")
  ) {
    return true;
  }

  // Discounts, cashback, points, refunds, and adjustments
  if (
    /\bdes\./i.test(norm) ||
    norm.includes("descuento") ||
    norm.includes("cash back") ||
    norm.includes("multipuntos") ||
    norm.includes("multipremios") ||
    norm.includes("devolucion") ||
    norm.includes("reembolso") ||
    norm.includes("ajuste")
  ) {
    return true;
  }

  // Statement summaries, metadata, and tables
  if (
    norm.includes("total movimientos") ||
    norm.includes("saldo anterior") ||
    norm.includes("saldo de contado") ||
    norm.includes("pago minimo") ||
    norm.includes("pago de contado") ||
    norm.includes("creditos/pagos") ||
    norm.includes("debitos/compras") ||
    norm.includes("limite de credito") ||
    norm.includes("credito disponible") ||
    norm.includes("sobregiro") ||
    norm.includes("saldo extraf") ||
    norm.includes("disponible extraf") ||
    norm.includes("cuota extraf") ||
    norm.includes("fecha de corte") ||
    norm.includes("fecha limite") ||
    norm.includes("tasa de interes") ||
    norm.includes("aplicacion de pagos") ||
    norm.includes("amortizacion de capital") ||
    norm.includes("intereses por financiamiento") ||
    norm.includes("comisiones y otros cargos") ||
    norm.includes("extrafinanciamientos")
  ) {
    return true;
  }

  return false;
}

/**
 * Coordinate-aware extractor for Banco Cuscatlán PDF credit card statements.
 * Uses exact geometric layout:
 * - Fecha de Operación: x ~ 20-60 (typically x ~ 40)
 * - Fecha de Proceso: x ~ 90-130 (typically x ~ 108)
 * - Concepto (merchant): x ~ 140-420 (typically x ~ 165)
 * - Débitos y Compras (expenses): x ~ 430-510 (typically x ~ 470)
 * - Créditos y Pagos (payments & discounts): x >= 520 (typically x ~ 560)
 */
export async function extractCuscatlanTransactionsFromParser(
  parser: PDFParserInstance,
  _rawText?: string
): Promise<{
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
}> {
  const transactions: Transaction[] = [];
  const debugLogs: PDFDebugLog[] = [];
  let skippedRowsCount = 0;
  let totalAmount = 0;

  const numPages = parser.doc.numPages;

  for (let p = 1; p <= numPages; p++) {
    const page = await parser.doc.getPage(p);
    const content = await page.getTextContent();
    const linesByY = new Map<number, { str: string; x: number }[]>();

    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      let matchedY: number | null = null;
      for (const k of linesByY.keys()) {
        if (Math.abs(k - y) <= 3) {
          matchedY = k;
          break;
        }
      }
      const targetY = matchedY !== null ? matchedY : y;
      if (!linesByY.has(targetY)) linesByY.set(targetY, []);
      linesByY.get(targetY)!.push({ str: item.str, x: Math.round(item.transform[4]) });
    }

    const sortedY = Array.from(linesByY.keys()).sort((a, b) => b - a);

    for (const y of sortedY) {
      const items = linesByY.get(y)!.sort((a, b) => a.x - b.x);

      // Check if line starts with an operation date at x < 80
      const firstItem = items[0]?.str.trim();
      const dateMatch = firstItem && firstItem.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (!dateMatch || items[0].x > 80) continue;

      const lineText = items.map((it) => it.str).join(" ");
      // Guard against summary lines that might contain dates (e.g. Fecha de Corte)
      if (
        lineText.includes("Fecha de Corte") ||
        lineText.includes("Fecha Límite") ||
        lineText.includes("Resolución")
      ) {
        continue;
      }

      const isoDate = normalizeCuscatlanDate(firstItem);
      if (!isoDate) continue;

      // Find amounts in line
      const amountRegex = /[Q\$]?\s*[\d,]+\.\d{2}/;
      const debitItem = items.find((it) => it.x >= 400 && it.x < 520 && amountRegex.test(it.str));
      const creditItem = items.find((it) => it.x >= 520 && amountRegex.test(it.str));

      // If amount is in the credit/payment column (x >= 520), log and skip as non-expense
      if (!debitItem && creditItem) {
        skippedRowsCount++;
        const descItems = items.filter((it) => it.x >= 140 && it.x < creditItem.x);
        const creditDesc = descItems.map((it) => it.str).join(" ").trim();
        debugLogs.push({
          type: "credit_or_payment",
          date: isoDate,
          description: creditDesc,
          amount: creditItem.str.trim(),
        });
        continue;
      }

      if (!debitItem) {
        continue;
      }

      // Description is between process date (x ~ 140) and debit amount
      const descItems = items.filter((it) => it.x >= 140 && it.x < debitItem.x);
      let rawDesc = descItems.map((it) => it.str).join(" ").trim();

      // If empty, fallback to items between date items and debit item
      if (!rawDesc) {
        const debitIdx = items.indexOf(debitItem);
        const fallbackItems = items.slice(2, debitIdx);
        rawDesc = fallbackItems.map((it) => it.str).join(" ").trim();
      }

      if (!rawDesc || isNonExpenseCuscatlanLine(rawDesc)) {
        skippedRowsCount++;
        continue;
      }

      const numMatch = debitItem.str.match(/([\d,]+\.\d{2})/);
      if (!numMatch) {
        skippedRowsCount++;
        continue;
      }

      const rawAmount = parseFloat(numMatch[1].replace(/,/g, ""));
      if (isNaN(rawAmount) || rawAmount <= 0) {
        skippedRowsCount++;
        continue;
      }

      const isUsd = debitItem.str.includes("$");
      const cleanDesc = cleanCuscatlanDescription(rawDesc);

      let finalAmount = rawAmount;
      let originalCurrency: "GTQ" | "USD" = "GTQ";
      let originalAmount: number | undefined = undefined;
      let exchangeRateApplied: number | undefined = undefined;

      if (isUsd) {
        const rate = getExchangeRate();
        finalAmount = convertUsdToGtq(rawAmount, rate);
        originalCurrency = "USD";
        originalAmount = Number(rawAmount.toFixed(2));
        exchangeRateApplied = rate;
      }

      totalAmount += finalAmount;

      transactions.push({
        id: `tx_cuscatlan_p${p}_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: isoDate,
        description: cleanDesc,
        amount: Number(finalAmount.toFixed(2)),
        currency: "GTQ",
        originalCurrency,
        originalAmount,
        exchangeRateApplied,
        classificationSource: "local",
        category: null,
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
 * Text-based parser for Banco Cuscatlán statements.
 * Useful for simulated fixtures, plain text copies, and unit testing.
 */
export function parseCuscatlanStatementText(text: string): {
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
} {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const transactions: Transaction[] = [];
  const debugLogs: PDFDebugLog[] = [];
  let skippedRowsCount = 0;
  let totalAmount = 0;

  for (const line of lines) {
    // Matches transaction line: Date1 Date2 Description Amount
    const match = line.match(
      /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s+(.+?)\s+([Q\$]?\s*[\d,]+\.\d{2})$/
    );
    if (!match) continue;

    const [, dateStr, rawDesc, amountStr] = match;

    const isoDate = normalizeCuscatlanDate(dateStr);
    if (!isoDate) continue;

    if (isNonExpenseCuscatlanLine(rawDesc)) {
      skippedRowsCount++;
      debugLogs.push({
        type: "credit_or_payment",
        date: isoDate,
        description: rawDesc,
        amount: amountStr,
      });
      continue;
    }

    const numMatch = amountStr.match(/([\d,]+\.\d{2})/);
    if (!numMatch) {
      skippedRowsCount++;
      continue;
    }

    const rawAmount = parseFloat(numMatch[1].replace(/,/g, ""));
    if (isNaN(rawAmount) || rawAmount <= 0) {
      skippedRowsCount++;
      continue;
    }

    const isUsd = amountStr.includes("$");
    const cleanDesc = cleanCuscatlanDescription(rawDesc);

    let finalAmount = rawAmount;
    let originalCurrency: "GTQ" | "USD" = "GTQ";
    let originalAmount: number | undefined = undefined;
    let exchangeRateApplied: number | undefined = undefined;

    if (isUsd) {
      const rate = getExchangeRate();
      finalAmount = convertUsdToGtq(rawAmount, rate);
      originalCurrency = "USD";
      originalAmount = Number(rawAmount.toFixed(2));
      exchangeRateApplied = rate;
    }

    totalAmount += finalAmount;

    transactions.push({
      id: `tx_cuscatlan_txt_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: isoDate,
      description: cleanDesc,
      amount: Number(finalAmount.toFixed(2)),
      currency: "GTQ",
      originalCurrency,
      originalAmount,
      exchangeRateApplied,
      classificationSource: "local",
      category: null,
    });
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
 * Coordinate-aware parser for Banco Cuscatlán statements directly from Uint8Array.
 */
export async function parseCuscatlanStatementFromBuffer(
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

  return extractCuscatlanTransactionsFromParser(parser, rawText);
}
