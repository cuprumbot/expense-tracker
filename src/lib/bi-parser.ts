import { Transaction, CSVParsingSummary } from "@/types/transaction";
import { convertUsdToGtq, getExchangeRate } from "@/lib/currency";
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
 * Extracts statement cut-off year and month from Banco Industrial statement text.
 * E.g., "Fecha de corte: 16 10 2026" or "16/10/2026" or "ABRIL/25".
 */
export function extractStatementPeriod(text: string): { year: string; month: string } {
  // Check for explicit "Fecha de corte: DD MM YYYY" or "DD/MM/YYYY"
  const corteMatch = text.match(/fecha\s+de\s+corte:?\s*(\d{1,2})[\/\-\s]+(\d{1,2})[\/\-\s]+(\d{4})/i);
  if (corteMatch) {
    return { year: corteMatch[3], month: corteMatch[2].padStart(2, "0") };
  }

  // Month-name slash year: "ABRIL/25" or "AGOSTO/2026"
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

  // Fallback: look for date pattern DD/MM/YYYY
  const dateMatch = text.match(/\b\d{1,2}\/(\d{2})\/(\d{4})\b/);
  if (dateMatch) {
    return { year: dateMatch[2], month: dateMatch[1] };
  }

  const isoMatch = text.match(/\b(\d{4})-(\d{2})-\d{2}\b/);
  if (isoMatch) {
    return { year: isoMatch[1], month: isoMatch[2] };
  }

  return { year: "2026", month: "10" };
}

/**
 * Normalizes Banco Industrial transaction dates to ISO "YYYY-MM-DD".
 * Handles formats like "12/10/26", "12/10/2026", "12-10-2026".
 */
export function normalizeBiDate(
  dateToken: string,
  cutoffYear?: number,
  cutoffMonth?: string
): string | null {
  if (!dateToken) return null;
  const trimmed = dateToken.trim();

  // Full or 2-digit year: DD/MM/YY or DD/MM/YYYY
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!match) return null;

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  let year = match[3];

  if (year.length === 2) {
    // If cutoffYear is provided, infer century accurately
    if (cutoffYear) {
      const century = Math.floor(cutoffYear / 100) * 100;
      year = String(century + parseInt(year, 10));
    } else {
      year = `20${year}`;
    }
  }

  // If cutoff provided and transaction month > cutoff month, roll year back
  if (cutoffYear && cutoffMonth) {
    if (parseInt(month, 10) > parseInt(cutoffMonth, 10)) {
      year = String(parseInt(year, 10) - 1);
    }
  }

  return `${year}-${month}-${day}`;
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
  desc = desc.replace(/^COMPRA\s+POS\s+/i, "");
  desc = desc.replace(/^COMPRA\s+/i, "");

  // If description contains address details after backslash, keep primary merchant name
  if (desc.includes("\\")) {
    desc = desc.split("\\")[0].trim();
  }

  // Strip trailing reference markers, auth codes, and location identifiers
  let prev = "";
  while (prev !== desc) {
    prev = desc;
    desc = desc.replace(/\s+(CIUDAD DE GUATEMALA|GUATEMALA GTM|GTM|GUA|GT)$/i, "");
    desc = desc.replace(/\s+SOBRE\/$/i, "");
    desc = desc.replace(/\.{2,}\d+$/g, "");
    desc = desc.trim();
  }

  // Collapse multiple whitespace characters into single space
  desc = desc.replace(/\s{2,}/g, " ");

  return desc.trim() || rawDesc.trim();
}

/**
 * Identifies whether a line is a credit, payment, refund, or non-expense summary record.
 */
export function isNonExpenseBiLine(description: string): boolean {
  const normalized = description.toLowerCase().trim();

  // Card or loan payments
  if (
    normalized.includes("gracias por su pago") ||
    normalized.includes("pago por internet") ||
    normalized.includes("pago internet") ||
    normalized.includes("pago de tarjeta") ||
    normalized.includes("pago tarjeta") ||
    normalized.includes("pago contado") ||
    normalized.includes("pago en efectivo") ||
    normalized.includes("pago agenc") ||
    normalized.includes("pago banca movil") ||
    normalized.includes("pago banca móvil") ||
    normalized.includes("pago electronico") ||
    normalized.includes("pago electrónico") ||
    normalized.includes("pago por bi en linea") ||
    normalized.includes("pago bi en linea") ||
    normalized.includes("pago ach") ||
    normalized.includes("pago a capital") ||
    normalized.includes("abono")
  ) {
    return true;
  }

  // Credit refunds, cashback, and reversals
  if (
    normalized.includes("nota credito") ||
    normalized.includes("credito cash back") ||
    normalized.includes("crédito cash back") ||
    normalized.includes("credito p/cargos") ||
    normalized.includes("puntos bi") ||
    normalized.includes("canje de puntos") ||
    normalized.includes("devolucion") ||
    normalized.includes("reembolso") ||
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
    normalized.includes("saldo en mora") ||
    normalized.includes("pago minimo") ||
    normalized.includes("pago mínimo") ||
    normalized.includes("credito disponible") ||
    normalized.includes("crédito disponible") ||
    normalized.includes("limite de credito") ||
    normalized.includes("límite de crédito") ||
    normalized.includes("sub - total") ||
    normalized.includes("sub-total") ||
    normalized.includes("total debitos") ||
    normalized.includes("total creditos") ||
    normalized.includes("total quetzales") ||
    normalized.includes("total dolares") ||
    normalized.includes("total dólares") ||
    normalized.includes("movimientos en quetzales") ||
    normalized.includes("movimientos en dolares") ||
    normalized.includes("movimientos en dólares") ||
    normalized.includes("otros cargos") ||
    normalized.includes("pagos realizados") ||
    normalized.includes("balance de intereses") ||
    normalized.includes("saldo de intereses") ||
    normalized.includes("resumen de movimientos") ||
    normalized.includes("detalle estado de cuenta")
  ) {
    return true;
  }

  return false;
}

/**
 * Coordinate-aware extractor for Banco Industrial credit card (Bi Credit) statements.
 * Column structure on transaction detail pages:
 * - Fecha de operación: x ~ 25-50 (format DD/MM/YY)
 * - Fecha de consumo: x ~ 90-120 (format DD/MM/YY)
 * - Descripción: x ~ 150-440
 * - Débitos: x ~ 440-485
 * - Créditos: x ~ 510-560
 */
export async function extractBiTransactionsFromParser(
  parser: PDFParserInstance,
  rawText: string
): Promise<{
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
}> {
  const transactions: Transaction[] = [];
  const debugLogs: PDFDebugLog[] = [];
  let skippedRowsCount = 0;
  let totalAmount = 0;

  const { year: cutYearStr, month: cutMonthStr } = extractStatementPeriod(rawText);
  const cutoffYear = parseInt(cutYearStr, 10);
  const cutoffMonth = cutMonthStr;

  const numPages = parser.doc.numPages;

  // Track active section currency ("GTQ" vs "USD")
  let activeSectionCurrency: "GTQ" | "USD" = "GTQ";

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

    // Multi-line holding state for wrapped description / amount
    let pendingDate: string | null = null;
    let pendingDesc = "";

    for (let i = 0; i < sortedY.length; i++) {
      const y = sortedY[i];
      const items = linesByY.get(y)!.sort((a, b) => a.x - b.x);
      const lineStr = items.map((it) => it.str).join(" ");

      // Section currency tracking
      if (lineStr.includes("MOVIMIENTOS EN DOLARES") || lineStr.includes("MOVIMIENTOS EN DÓLARES")) {
        activeSectionCurrency = "USD";
        pendingDate = null;
        pendingDesc = "";
        continue;
      }
      if (lineStr.includes("MOVIMIENTOS EN QUETZALES")) {
        activeSectionCurrency = "GTQ";
        pendingDate = null;
        pendingDesc = "";
        continue;
      }

      // Ignore section summary / totals rows
      if (
        lineStr.includes("TOTAL QUETZALES") ||
        lineStr.includes("TOTAL DOLARES") ||
        lineStr.includes("TOTAL DÓLARES") ||
        lineStr.includes("Fecha de operación") ||
        lineStr.includes("Resumen de movimientos") ||
        lineStr.includes("Saldo anterior") ||
        lineStr.includes("Saldo al corte") ||
        lineStr.includes("Límite de crédito") ||
        lineStr.includes("Crédito disponible") ||
        lineStr.includes("PAGO A CAPITAL") ||
        lineStr.includes("SALDO DE INTERESES") ||
        lineStr.includes("Nota: Favor de revisar")
      ) {
        pendingDate = null;
        pendingDesc = "";
        continue;
      }

      // Amount regex: digits with decimals, optional thousand commas, or .00
      const amountRegex = /^[\d,]+\.\d{2}$/;

      // Detect date tokens
      const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
      const opDateItem = items.find((it) => it.x >= 20 && it.x <= 55 && dateRegex.test(it.str.trim()));
      const consDateItem = items.find((it) => it.x >= 85 && it.x <= 130 && dateRegex.test(it.str.trim()));

      const hasDate = Boolean(opDateItem || consDateItem);

      // Débitos (x ~ 440-485) and Créditos (x ~ 510-560)
      const debitItem = items.find(
        (it) => it.x >= 440 && it.x <= 485 && amountRegex.test(it.str.trim()) && it.str.trim() !== ".00"
      );
      const creditItem = items.find(
        (it) => it.x >= 510 && it.x <= 560 && amountRegex.test(it.str.trim()) && it.str.trim() !== ".00"
      );

      const hasAmount = Boolean(debitItem || creditItem);

      // Case 1: Line has date but no amount (first line of a wrapped row)
      if (hasDate && !hasAmount) {
        const txDateItem = consDateItem || opDateItem;
        pendingDate = normalizeBiDate(txDateItem!.str, cutoffYear, cutoffMonth);
        const descItems = items.filter((it) => it.x >= 150 && it.x < 440);
        pendingDesc = descItems.map((it) => it.str).join(" ").trim();
        continue;
      }

      // Case 2: Line has amount and belongs to a previous date or has date on current line
      let txDate: string | null = null;
      let rawDesc = "";

      if (hasDate) {
        const txDateItem = consDateItem || opDateItem;
        txDate = normalizeBiDate(txDateItem!.str, cutoffYear, cutoffMonth);
        const descItems = items.filter((it) => it.x >= 150 && it.x < (debitItem ? debitItem.x : creditItem ? creditItem.x : 440));
        rawDesc = descItems.map((it) => it.str).join(" ").trim();
      } else if (pendingDate && hasAmount) {
        txDate = pendingDate;
        const descItems = items.filter((it) => it.x >= 150 && it.x < (debitItem ? debitItem.x : creditItem ? creditItem.x : 440));
        const lineDesc = descItems.map((it) => it.str).join(" ").trim();
        rawDesc = pendingDesc ? `${pendingDesc} ${lineDesc}`.trim() : lineDesc;
        pendingDate = null;
        pendingDesc = "";
      } else {
        continue;
      }

      if (!txDate) continue;

      // Handle payments / credits (in Créditos column or payment description)
      if (creditItem || isNonExpenseBiLine(rawDesc)) {
        skippedRowsCount++;
        debugLogs.push({
          type: "credit_or_payment",
          date: txDate,
          description: rawDesc,
          amount: creditItem ? creditItem.str : debitItem ? debitItem.str : "0.00",
        });
        continue;
      }

      if (!debitItem) continue;

      const rawAmountStr = debitItem.str.replace(/,/g, "").trim();
      const rawAmount = parseFloat(rawAmountStr);
      if (isNaN(rawAmount) || rawAmount <= 0) {
        skippedRowsCount++;
        continue;
      }

      const cleanDesc = cleanBiDescription(rawDesc);
      const isUsd = activeSectionCurrency === "USD" || debitItem.str.includes("$");

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
        id: `tx_bi_p${p}_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: txDate,
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
 * Text-based parser for Banco Industrial credit card statements.
 * Useful for simulated fixtures, plain text copies, and unit testing.
 */
export function parseBiStatementText(text: string): {
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
} {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const transactions: Transaction[] = [];
  const debugLogs: PDFDebugLog[] = [];
  let skippedRowsCount = 0;
  let totalAmount = 0;

  const { year: cutYearStr, month: cutMonthStr } = extractStatementPeriod(text);
  const cutoffYear = parseInt(cutYearStr, 10);
  const cutoffMonth = cutMonthStr;

  let activeSectionCurrency: "GTQ" | "USD" = "GTQ";

  // Regex matching BI lines:
  // [OpDate] [ConsDate] [Description] [Debit Amount] [Optional Credit Amount]
  // or [OpDate] [ConsDate] [Description] [Amount]
  const lineRegexWithCredit =
    /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+([Q\$]?\s*[\d,]*\.\d{2})\s+([Q\$]?\s*[\d,]*\.\d{2})$/i;

  const lineRegexSingleAmount =
    /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+([Q\$]?\s*[\d,]*\.\d{2}-?)$/i;

  for (const line of lines) {
    if (line.includes("MOVIMIENTOS EN DOLARES") || line.includes("MOVIMIENTOS EN DÓLARES")) {
      activeSectionCurrency = "USD";
      continue;
    }
    if (line.includes("MOVIMIENTOS EN QUETZALES")) {
      activeSectionCurrency = "GTQ";
      continue;
    }

    let dateStr = "";
    let rawDesc = "";
    let debitStr = "";
    let creditStr = "";

    const matchWithCredit = line.match(lineRegexWithCredit);
    if (matchWithCredit) {
      dateStr = matchWithCredit[2]; // Use consumption date
      rawDesc = matchWithCredit[3];
      debitStr = matchWithCredit[4];
      creditStr = matchWithCredit[5];
    } else {
      const matchSingle = line.match(lineRegexSingleAmount);
      if (!matchSingle) continue;
      dateStr = matchSingle[2];
      rawDesc = matchSingle[3];
      debitStr = matchSingle[4];
    }

    const isoDate = normalizeBiDate(dateStr, cutoffYear, cutoffMonth);
    if (!isoDate) continue;

    const isCredit = creditStr && parseFloat(creditStr.replace(/[Q\$,\s]/g, "")) > 0;
    const isTrailingMinus = debitStr.endsWith("-");

    if (isCredit || isTrailingMinus || isNonExpenseBiLine(rawDesc)) {
      skippedRowsCount++;
      debugLogs.push({
        type: "credit_or_payment",
        date: isoDate,
        description: rawDesc,
        amount: creditStr || debitStr,
      });
      continue;
    }

    const cleanAmt = debitStr.replace(/[Q\$,\s-]/g, "");
    const rawAmount = parseFloat(cleanAmt);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      skippedRowsCount++;
      continue;
    }

    const cleanDesc = cleanBiDescription(rawDesc);
    const isUsd = activeSectionCurrency === "USD" || debitStr.includes("$");

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
      id: `tx_bi_txt_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
