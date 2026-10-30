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
 * Extracts statement cut-off year and month from Banco Ficohsa statement text.
 * E.g., "Período del 23/09/2026 al 23/10/2026" or "Fecha de corte: viernes, 23 oct. 2026".
 */
export function extractFicohsaCutoffDate(rawText: string): { year: number; month: string } {
  const periodMatch = rawText.match(/al\s+(\d{1,2})\/(\d{2})\/(\d{4})/i);
  if (periodMatch) {
    return { year: parseInt(periodMatch[3], 10), month: periodMatch[2] };
  }

  const corteMatch = rawText.match(/fecha\s+de\s+corte:?[^\n\d]*\d{1,2}\s+([a-z]{3,})\.?\s+(\d{4})/i);
  if (corteMatch) {
    const mStr = corteMatch[1].toLowerCase().slice(0, 3);
    const mNum = SPANISH_MONTHS[mStr] || "10";
    return { year: parseInt(corteMatch[2], 10), month: mNum };
  }

  const fallbackMatch = rawText.match(/\b\d{1,2}\/(\d{2})\/(\d{4})\b/);
  if (fallbackMatch) {
    return { year: parseInt(fallbackMatch[2], 10), month: fallbackMatch[1] };
  }

  return { year: 2026, month: "10" };
}

/**
 * Normalizes Ficohsa statement dates into ISO "YYYY-MM-DD".
 * Primarily handles "DD/MM/YYYY" or "DD-MM-YYYY".
 */
export function normalizeFicohsaDate(dateToken: string): string | null {
  if (!dateToken) return null;
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

  return null;
}

/**
 * Cleans and sanitizes merchant descriptions from Banco Ficohsa credit card statements.
 * Strips leading auth/comprobante codes, POS markers, and trailing location/country tokens.
 */
export function cleanFicohsaDescription(rawDesc: string): string {
  if (!rawDesc) return "";
  let desc = rawDesc.trim();

  // Strip leading authorization / comprobante numbers (e.g. "012756 DOMINOS...", "C87103 ...", "R83792 ...")
  desc = desc.replace(/^(?:[A-Z]?\d{5,7})\s+/i, "");

  // Strip POS prefixes
  desc = desc.replace(/^(COMPRA\s+POS|POS\s+FICOHSA|POS|COMPRA)\s+/i, "");

  let prev = "";
  while (prev !== desc) {
    prev = desc;
    // Strip trailing department / country strings
    desc = desc.replace(
      /\s+(CIUDAD DE GUATEMALA|GUATEMALACITY|GUATEMALA|GTM|GUA|GT)$/i,
      ""
    );
    desc = desc.replace(/\s+(PUERTO BARRIOS|PUERTO BARRIO|IZABAL|IZA)$/i, "");
    desc = desc.replace(/\s+(SACATEPEQUEZ|SAC)$/i, "");
    desc = desc.replace(/\s+(ZACAPA|ZAC)$/i, "");
    desc = desc.replace(/\s+(QUETZALTENANGO|XELA|QUE)$/i, "");
    desc = desc.replace(/\s+(ESCUINTLA|ESC)$/i, "");
    desc = desc.replace(/\s+(PETEN|PET)$/i, "");
    desc = desc.replace(/\s+(CHIMALTENANGO|CHIMAL)$/i, "");
    desc = desc.replace(
      /\s+(SUCHITEPEQUEZ|RETALHULEU|SAN MARCOS|SOLOLA|JUTIAPA|JALAPA|ALTA VERAPAZ|BAJA VERAPAZ)$/i,
      ""
    );
    // Strip trailing reference dots and masked numbers
    desc = desc.replace(/\.{2,}\d+$/g, "");
    desc = desc.trim();
  }

  // Collapse consecutive whitespace
  desc = desc.replace(/\s{2,}/g, " ");

  return desc.trim() || rawDesc.trim();
}

/**
 * Identifies non-expense lines, payments, rewards disbursements,
 * or summary rows from Banco Ficohsa statements.
 */
export function isNonExpenseFicohsaLine(desc: string): boolean {
  const norm = desc.toLowerCase().trim();

  // Payments and credits
  if (
    norm.includes("gracias por su pago") ||
    norm.includes("pago al saldo") ||
    norm.includes("pago de contado") ||
    norm.includes("pago recibido") ||
    norm.includes("pago por sucursal") ||
    norm.includes("pago internet") ||
    norm.includes("pago de tarjeta") ||
    norm.includes("pago banca") ||
    norm.includes("abono")
  ) {
    return true;
  }

  // Rewards, cash back, points adjustments
  if (
    norm.includes("puntos disfruta") ||
    norm.includes("puntos ficohsa") ||
    norm.includes("canje de puntos") ||
    norm.includes("cash back") ||
    norm.includes("devolucion") ||
    norm.includes("reembolso") ||
    norm.includes("ajuste")
  ) {
    return true;
  }

  // Statement summaries, card headers, and table totals
  if (
    norm.includes("total de pagos y creditos") ||
    norm.includes("total de pagos y créditos") ||
    norm.includes("total de tarjeta") ||
    norm.includes("compras y retiros") ||
    norm.includes("saldo anterior") ||
    norm.includes("saldo total") ||
    norm.includes("pago mínimo") ||
    norm.includes("pago minimo") ||
    norm.includes("límite de crédito") ||
    norm.includes("limite de credito") ||
    norm.includes("disponible para consumo") ||
    norm.includes("disponible para cuotas") ||
    norm.includes("extrafinanciamiento") ||
    norm.includes("resumen de pago") ||
    norm.includes("resumen de transacciones") ||
    norm.includes("intereses") ||
    norm.includes("movimiento de cuenta") ||
    norm.includes("detalle transaccion") ||
    norm.includes("detalle transacción") ||
    norm.includes("período del") ||
    norm.includes("periodo del") ||
    norm.includes("fecha de corte") ||
    norm.includes("fecha máxima de pago") ||
    norm.includes("fecha maxima de pago")
  ) {
    return true;
  }

  return false;
}

/**
 * Coordinate-aware extractor for Banco Ficohsa credit card statements.
 * Column layout on statement detail pages (typically Page 2):
 * - Consumo (Tx Date): x ~ 25-45
 * - Operación (Post Date): x ~ 65-95
 * - Cmpte. (Auth code): x ~ 115-145
 * - Detalle Transacción: x ~ 150-365
 * - Quetzales: x ~ 370-420
 * - Dólares: x ~ 425-480
 */
export async function extractFicohsaTransactionsFromParser(
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

      // Ignore section headers, summary lines, and table titles
      if (
        lineStr.includes("MOVIMIENTO DE CUENTA") ||
        lineStr.includes("TOTAL DE PAGOS Y CREDITOS") ||
        lineStr.includes("TOTAL DE TARJETA") ||
        lineStr.includes("+ COMPRAS Y RETIROS") ||
        lineStr.includes("INFORMACIÓN DE PAGO") ||
        lineStr.includes("RESUMEN DE TRANSACCIONES") ||
        lineStr.includes("Período del") ||
        lineStr.includes("Consumo Operación") ||
        lineStr.includes("Gráfica de detalle") ||
        lineStr.includes("ESTADO DE CUENTA")
      ) {
        continue;
      }

      // Check if line starts with a consumption date (x ~ 25-50) formatted as DD/MM/YYYY
      const dateItem = items.find(
        (it) => it.x >= 20 && it.x <= 55 && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(it.str.trim())
      );
      if (!dateItem) continue;

      const isoDate = normalizeFicohsaDate(dateItem.str);
      if (!isoDate) continue;

      // Detect amount items in Quetzales (x ~ 370-420) and Dólares (x ~ 425-480)
      const amountRegex = /^-?[Q\$]?\s*[\d,]+\.\d{2}-?$/;
      const gtqItem = items.find(
        (it) => it.x >= 365 && it.x <= 420 && amountRegex.test(it.str.trim())
      );
      const usdItem = items.find(
        (it) => it.x >= 425 && it.x <= 480 && amountRegex.test(it.str.trim())
      );

      // Extract raw description items between auth code/post date and the first amount column
      const firstAmountX = gtqItem ? gtqItem.x : usdItem ? usdItem.x : 370;
      const descItems = items.filter((it) => it.x >= 150 && it.x < firstAmountX);
      const rawDesc = descItems.map((it) => it.str).join(" ").trim();

      // Check for payments/credits (negative signs e.g. -Q3,770.71, or description matching payment)
      const isGtqNegative = gtqItem ? (gtqItem.str.startsWith("-") || gtqItem.str.endsWith("-")) : false;
      const isUsdNegative = usdItem ? (usdItem.str.startsWith("-") || usdItem.str.endsWith("-")) : false;

      if (isGtqNegative || isUsdNegative || isNonExpenseFicohsaLine(rawDesc)) {
        skippedRowsCount++;
        debugLogs.push({
          type: "credit_or_payment",
          date: isoDate,
          description: rawDesc,
          amount: gtqItem ? gtqItem.str : usdItem ? usdItem.str : "0.00",
        });
        continue;
      }

      // Parse debit amounts
      let rawAmount = 0;
      let isUsd = false;

      if (gtqItem) {
        const cleanStr = gtqItem.str.replace(/[Q\$,\s-]/g, "");
        const parsed = parseFloat(cleanStr);
        if (!isNaN(parsed) && parsed > 0) {
          rawAmount = parsed;
          isUsd = false;
        }
      }

      if (rawAmount === 0 && usdItem) {
        const cleanStr = usdItem.str.replace(/[Q\$,\s-]/g, "");
        const parsed = parseFloat(cleanStr);
        if (!isNaN(parsed) && parsed > 0) {
          rawAmount = parsed;
          isUsd = true;
        }
      }

      if (rawAmount <= 0 || !rawDesc) {
        skippedRowsCount++;
        continue;
      }

      const cleanDesc = cleanFicohsaDescription(rawDesc);

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
        id: `tx_ficohsa_p${p}_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
 * Text-based parser for Banco Ficohsa statements.
 * Useful for simulated fixtures, plain text copies, and unit testing.
 */
export function parseFicohsaStatementText(text: string): {
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
} {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const transactions: Transaction[] = [];
  const debugLogs: PDFDebugLog[] = [];
  let skippedRowsCount = 0;
  let totalAmount = 0;

  // Regex matching: [DD/MM/YYYY] [DD/MM/YYYY] [Optional Auth Code] [Description] [Amount in Q or $]
  const lineRegex =
    /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(?:\d{1,2}\/\d{1,2}\/\d{4}\s+)?(?:[A-Z]?\d{5,7}\s+)?(.+?)\s+(-?[Q\$]?\s*[\d,]+\.\d{2}-?)$/i;

  for (const line of lines) {
    const match = line.match(lineRegex);
    if (!match) continue;

    const [, dateStr, rawDesc, amountStr] = match;

    const isoDate = normalizeFicohsaDate(dateStr);
    if (!isoDate) continue;

    const isCredit = amountStr.startsWith("-") || amountStr.endsWith("-");
    if (isCredit || isNonExpenseFicohsaLine(rawDesc)) {
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
    const cleanDesc = cleanFicohsaDescription(rawDesc);

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
      id: `tx_ficohsa_txt_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
 * Coordinate-aware parser for Banco Ficohsa statements directly from Uint8Array.
 */
export async function parseFicohsaStatementFromBuffer(
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

  return extractFicohsaTransactionsFromParser(parser, rawText);
}
