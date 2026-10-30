import { Transaction, CSVParsingSummary } from "@/types/transaction";
import { convertUsdToGtq, getExchangeRate } from "@/lib/currency";
import type { PDFParserInstance, PDFDebugLog } from "@/lib/pdf-parser";

const SPANISH_MONTHS: Record<string, string> = {
  ene: "01", enero: "01", jan: "01",
  feb: "02", febrero: "02",
  mar: "03", marzo: "03",
  abr: "04", abril: "04", apr: "04",
  may: "05", mayo: "05",
  jun: "06", junio: "06",
  jul: "07", julio: "07",
  ago: "08", agosto: "08", aug: "08",
  sep: "09", set: "09", septiembre: "09",
  oct: "10", octubre: "10",
  nov: "11", noviembre: "11",
  dic: "12", diciembre: "12", dec: "12",
};

/**
 * Extracts the statement cutoff year and month from BAC Credomatic statement text.
 * Typically formatted as "DD-MMM-YYYY" (e.g., "15-OCT-2026").
 */
export function extractBacCutoffDate(rawText: string): { year: number; month: string } {
  const match = rawText.match(/\b\d{1,2}-([A-Z]{3})-(\d{4})\b/i);
  if (match) {
    const monthKey = match[1].toLowerCase();
    const month = SPANISH_MONTHS[monthKey] || "10";
    const year = parseInt(match[2], 10);
    return { year, month };
  }

  // Fallback: search for DD/MM/YYYY
  const dateMatch = rawText.match(/\b\d{1,2}\/(\d{2})\/(\d{4})\b/);
  if (dateMatch) {
    return { year: parseInt(dateMatch[2], 10), month: dateMatch[1] };
  }

  return { year: 2026, month: "10" };
}

/**
 * Normalizes a BAC transaction date token (e.g. "SEP/16", "OCT/11", "16-SEP", "16 SEP", "21/SEP", or "16/09/2026") into ISO "YYYY-MM-DD".
 */
export function normalizeBacDate(
  dateToken: string,
  cutoffYear: number,
  cutoffMonth: string
): string | null {
  const trimmed = dateToken.trim();

  // Full date: DD/MM/YYYY or DD-MM-YYYY
  const fullMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (fullMatch) {
    const day = fullMatch[1].padStart(2, "0");
    const month = fullMatch[2].padStart(2, "0");
    let year = fullMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  // Month-first: MMM/DD, MMM-DD, MMM DD (e.g. SEP/21, OCT/11, SEP 21)
  const mmmFirst = trimmed.match(/^([A-Za-z]{3,})[\/\-\s]+(\d{1,2})$/);
  if (mmmFirst) {
    const mStr = mmmFirst[1].toLowerCase();
    const mNum = SPANISH_MONTHS[mStr];
    if (!mNum) return null;
    const dNum = mmmFirst[2].padStart(2, "0");
    let txYear = cutoffYear;
    // If transaction month is numerically greater than statement cutoff month, it belongs to previous year
    if (parseInt(mNum, 10) > parseInt(cutoffMonth, 10)) {
      txYear = cutoffYear - 1;
    }
    return `${txYear}-${mNum}-${dNum}`;
  }

  // Day-first: DD/MMM, DD-MMM, DD MMM (e.g. 21/SEP, 11-OCT, 21 SEP)
  const dddFirst = trimmed.match(/^(\d{1,2})[\/\-\s]+([A-Za-z]{3,})$/);
  if (dddFirst) {
    const mStr = dddFirst[2].toLowerCase();
    const mNum = SPANISH_MONTHS[mStr];
    if (!mNum) return null;
    const dNum = dddFirst[1].padStart(2, "0");
    let txYear = cutoffYear;
    if (parseInt(mNum, 10) > parseInt(cutoffMonth, 10)) {
      txYear = cutoffYear - 1;
    }
    return `${txYear}-${mNum}-${dNum}`;
  }

  return null;
}

/**
 * Cleans and normalizes BAC merchant descriptions.
 * Strips internal POS markers, transaction type flags (-VN-, -VC-, -TC-),
 * masked card numbers, and location suffixes.
 */
export function cleanBacDescription(rawDesc: string): string {
  if (!rawDesc) return "";
  let desc = rawDesc.trim();

  // Strip POS prefixes
  desc = desc.replace(/^(COMPRA\s+POS|POS\s+BAC|POS|COMPRA)\s+/i, "");

  let prev = "";
  while (prev !== desc) {
    prev = desc;
    desc = desc.replace(/\s*-[A-Z]{2}-\s*/gi, " ");
    desc = desc.replace(/\s+-[A-Z]{2}\b/gi, "");
    desc = desc.replace(/\.{2,}\d+$/g, "");
    desc = desc.replace(/\s+(CIUDAD DE GUATEMALA|GUATEMALA|GTM|GUA|GT)$/i, "");
    desc = desc.replace(/\s+AMEX(\s+BAC)?$/i, "");
    desc = desc.trim();
  }

  // Collapse consecutive whitespace
  desc = desc.replace(/\s{2,}/g, " ");

  return desc.trim() || rawDesc.trim();
}

/**
 * Identifies whether a description or line text is a payment, adjustment,
 * points cashback, or statement summary.
 */
export function isNonExpenseBacLine(desc: string): boolean {
  const norm = desc.toLowerCase().trim();

  // Payments to the card
  if (
    norm.startsWith("pago") ||
    norm.includes("su pago") ||
    norm.includes("pago recibido") ||
    norm.includes("pago en efectivo") ||
    norm.includes("pago por transferencia") ||
    norm.includes("credito por pago") ||
    norm.includes("pago de tarjeta") ||
    norm.includes("pago banca en linea") ||
    norm.includes("abono")
  ) {
    return true;
  }

  // Rewards, loyalty cashback, and point adjustments
  if (
    norm.includes("walmart cash") ||
    norm.includes("puntos canjeables") ||
    norm.includes("credito cash back") ||
    norm.includes("puntos bac") ||
    norm.includes("canje de puntos") ||
    norm.includes("devolucion") ||
    norm.includes("reembolso") ||
    norm.includes("ajuste")
  ) {
    return true;
  }

  // Summaries and table headers
  if (
    norm.includes("débito") ||
    norm.includes("debito") ||
    norm.includes("crédito") ||
    norm.includes("credito") ||
    norm.includes("integración") ||
    norm.includes("integracion") ||
    norm.includes("pago mínimo") ||
    norm.includes("pago minimo") ||
    norm.includes("saldo anterior") ||
    norm.includes("saldo a la fecha de corte") ||
    norm.includes("intereses bonificables") ||
    norm.includes("intereses por mora") ||
    norm.includes("interés sobre saldo") ||
    norm.includes("límite compartido") ||
    norm.includes("disponible compartido") ||
    norm.includes("saldo compartido") ||
    norm.includes("límite de crédito") ||
    norm.includes("compras y otros cargos") ||
    norm.includes("pagos y abonos")
  ) {
    return true;
  }

  return false;
}

/**
 * Coordinate-aware extractor for BAC Credomatic PDF credit card statements.
 * Column layout on statement detail pages:
 * - Tipo de transacción: x ~ 20-40 (typically x ~ 29)
 * - Fecha de consumo: x ~ 70-110 (typically x ~ 86)
 * - Fecha de operación: x ~ 125-155 (typically x ~ 134)
 * - Descripción: x ~ 160-330 (typically x ~ 174)
 * - Quetzales Débitos: x ~ 335-385 (typically x ~ 354)
 * - Quetzales Créditos: x ~ 395-445 (typically x ~ 416)
 * - Dólares Débitos: x ~ 455-505 (typically x ~ 475)
 * - Dólares Créditos: x ~ 515-565 (typically x ~ 540)
 */
export async function extractBacTransactionsFromParser(
  parser: PDFParserInstance,
  rawText?: string
): Promise<{
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
}> {
  const transactions: Transaction[] = [];
  const debugLogs: PDFDebugLog[] = [];
  let skippedRowsCount = 0;
  let totalAmount = 0;

  const fullText = rawText || "";
  const { year: cutoffYear, month: cutoffMonth } = extractBacCutoffDate(fullText);
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
        if (Math.abs(k - y) <= 2) {
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
      const lineStr = items.map((it) => it.str).join(" ");

      // Ignore summary lines, headers, and footer notes
      if (
        lineStr.includes("DÉBITO") ||
        lineStr.includes("CRÉDITO") ||
        lineStr.includes("INTEGRACIÓN") ||
        lineStr.includes("Pago mínimo de la") ||
        lineStr.includes("Amortización") ||
        lineStr.includes("Total")
      ) {
        continue;
      }

      // Find date item in consumption date column (x ~ 70-115)
      const dateItem = items.find(
        (it) => it.x >= 70 && it.x < 115 && /[A-Za-z]{3}\/\d{1,2}|\d{1,2}\/[A-Za-z]{3}|\d{1,2}[\/\-]\d{1,2}/i.test(it.str)
      );
      if (!dateItem) continue;

      const isoDate = normalizeBacDate(dateItem.str, cutoffYear, cutoffMonth);
      if (!isoDate) continue;

      // Detect amounts in columns
      const amountRegex = /^[\d,]+\.\d{2}-?$/;
      const gtqDebit = items.find((it) => it.x >= 335 && it.x < 385 && amountRegex.test(it.str) && it.str !== ".00");
      const gtqCredit = items.find((it) => it.x >= 395 && it.x < 445 && amountRegex.test(it.str) && it.str !== ".00");
      const usdDebit = items.find((it) => it.x >= 455 && it.x < 505 && amountRegex.test(it.str) && it.str !== ".00");
      const usdCredit = items.find((it) => it.x >= 515 && it.x < 565 && amountRegex.test(it.str) && it.str !== ".00");

      // Handle credits/payments (in either GTQ or USD credit columns, or with trailing minus)
      if (!gtqDebit && !usdDebit) {
        const creditItem = gtqCredit || usdCredit;
        if (creditItem) {
          skippedRowsCount++;
          const descItems = items.filter((it) => it.x >= 160 && it.x < creditItem.x);
          const creditDesc = descItems.map((it) => it.str).join(" ").trim();
          debugLogs.push({
            type: "credit_or_payment",
            date: isoDate,
            description: creditDesc,
            amount: creditItem.str,
          });
        }
        continue;
      }

      const activeDebit = gtqDebit || usdDebit;
      if (!activeDebit) continue;

      // Extract description between process date and debit amount
      const descItems = items.filter((it) => it.x >= 160 && it.x < activeDebit.x);
      const rawDesc = descItems.map((it) => it.str).join(" ").trim();

      if (!rawDesc || isNonExpenseBacLine(rawDesc)) {
        skippedRowsCount++;
        continue;
      }

      const rawAmountStr = activeDebit.str.replace(/-/g, "").replace(/,/g, "");
      const rawAmount = parseFloat(rawAmountStr);
      if (isNaN(rawAmount) || rawAmount <= 0) {
        skippedRowsCount++;
        continue;
      }

      const isUsd = !gtqDebit && Boolean(usdDebit);
      const cleanDesc = cleanBacDescription(rawDesc);

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
        id: `tx_bac_p${p}_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
 * Text-based parser for BAC Credomatic statements.
 * Useful for simulated fixtures, plain text copies, and unit testing.
 */
export function parseBacStatementText(text: string): {
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
} {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const transactions: Transaction[] = [];
  const debugLogs: PDFDebugLog[] = [];
  let skippedRowsCount = 0;
  let totalAmount = 0;

  const { year: cutoffYear, month: cutoffMonth } = extractBacCutoffDate(text);

  const lineRegex =
    /^(?:\d{1,3}\s+)?([A-Za-z]{3,}[\/\-]\d{1,2}|\d{1,2}[\/\-][A-Za-z]{3,}|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s+(?:(?:[A-Za-z]{3,}[\/\-]\d{1,2}|\d{1,2}[\/\-][A-Za-z]{3,}|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s+)?(.+?)\s+([Q\$]?\s*[\d,]+\.\d{2}-?)$/i;

  for (const line of lines) {
    const match = line.match(lineRegex);
    if (!match) continue;

    const [, dateStr, rawDesc, amountStr] = match;

    const isoDate = normalizeBacDate(dateStr, cutoffYear, cutoffMonth);
    if (!isoDate) continue;

    const isCredit = amountStr.endsWith("-");
    if (isCredit || isNonExpenseBacLine(rawDesc)) {
      skippedRowsCount++;
      debugLogs.push({
        type: "credit_or_payment",
        date: isoDate,
        description: rawDesc,
        amount: amountStr,
      });
      continue;
    }

    const cleanAmt = amountStr.replace(/[Q\$,\s-]/g, "");
    const rawAmount = parseFloat(cleanAmt);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      skippedRowsCount++;
      continue;
    }

    const isUsd = amountStr.includes("$");
    const cleanDesc = cleanBacDescription(rawDesc);

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
      id: `tx_bac_txt_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
 * Coordinate-aware parser for BAC statements directly from Uint8Array.
 */
export async function parseBacStatementFromBuffer(
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

  return extractBacTransactionsFromParser(parser, rawText);
}
