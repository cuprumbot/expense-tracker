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

  // Strip POS / Debit prefixes (preserve ATM / concept for classification)
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
 * Identifies whether a line is a credit, deposit, loan disbursement, payment, or non-expense summary record.
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
    // Note: In BI statements, "PAGO CHEQUE" is a debit where customer paid by check.
    if (
      normalized.includes("pago cheque") &&
      !normalized.includes("tarjeta") &&
      !normalized.includes("agenc")
    ) {
      return false;
    }
    return true;
  }

  // Credit refunds, deposits, cashback, incoming transfers
  if (
    normalized.includes("nota credito") ||
    normalized.includes("credito cash back") ||
    normalized.includes("credito p/cargos") ||
    normalized.includes("devolucion") ||
    normalized.includes("intereses ganados") ||
    normalized.includes("interes capitalizado") ||
    normalized.includes("deposito nomina") ||
    normalized.includes("deposito monetario") ||
    normalized.includes("deposito de ahorro") ||
    normalized.includes("deposito en efectivo") ||
    normalized.includes("remesa familiar") ||
    normalized.includes("remesas")
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
    normalized.includes("detalle estado de cuenta") ||
    normalized.includes("****saldo anterior****")
  ) {
    return true;
  }

  return false;
}

/**
 * Coordinate-aware extractor for Banco Industrial PDF statements (BI-2025-xx.pdf).
 * Uses exact geometric column coordinates:
 * - Day: x ~ 20-40 (x ~ 30)
 * - Doc: x ~ 50-70
 * - Description: x ~ 70-270
 * - Débito (expenses): x < 350 (typically x ~ 290-300)
 * - Crédito (deposits/payments): 350 <= x < 420 (typically x ~ 365-376)
 * - Saldo: x >= 420 (typically x ~ 440-447)
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

  const { year, month } = extractStatementPeriod(rawText);
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

    for (const [, items] of linesByY.entries()) {
      items.sort((a, b) => a.x - b.x);

      // Transaction line starts with 2-digit day (x ~ 20-40)
      if (!/^\d{2}$/.test(items[0]?.str.trim())) continue;

      const day = items[0].str.trim();
      const amountItems = items.filter((it) => /^[\d,]+\.\d{2}$/.test(it.str.trim()));

      // Débito column is located at x < 350 (centered at ~290-300)
      const debitItem = amountItems.find((it) => it.x < 350);

      if (!debitItem) {
        // If no debit amount, this row is a deposit/credit (at x >= 350)
        const creditItem = amountItems.find((it) => it.x >= 350 && it.x < 420);
        if (creditItem) {
          skippedRowsCount++;
          const descItems = items.filter((it) => it.x >= 70 && it.x < 350);
          const creditDesc = descItems.map((it) => it.str).join(" ").trim();
          debugLogs.push({
            type: "credit_or_payment",
            date: `${year}-${month}-${day}`,
            description: creditDesc,
            amount: `Q ${creditItem.str}`,
          });
        }
        continue;
      }

      // Description is between doc number (x ~ 70) and debit column (x ~ 270)
      const descItems = items.filter((it) => it.x >= 70 && it.x < 270);
      let rawDesc = descItems.map((it) => it.str).join(" ").trim();

      if (!rawDesc) {
        // Fallback: items between day/doc and debit item
        const debitIdx = items.indexOf(debitItem);
        const fallbackItems = items.slice(2, debitIdx);
        rawDesc = fallbackItems.map((it) => it.str).join(" ").trim();
      }

      if (!rawDesc || isNonExpenseBiLine(rawDesc) || rawDesc.includes("SALDO ANTERIOR")) {
        skippedRowsCount++;
        continue;
      }

      const amountVal = parseFloat(debitItem.str.replace(/,/g, ""));
      if (isNaN(amountVal) || amountVal <= 0) {
        skippedRowsCount++;
        continue;
      }

      const isoDate = `${year}-${month}-${day}`;
      const cleanDesc = cleanBiDescription(rawDesc);
      totalAmount += amountVal;

      transactions.push({
        id: `tx_bi_p${p}_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: isoDate,
        description: cleanDesc,
        amount: Number(amountVal.toFixed(2)),
        currency: "GTQ",
        originalCurrency: "GTQ",
        originalAmount: Number(amountVal.toFixed(2)),
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
 * Text-based parser for Banco Industrial statements.
 * Useful for simulated statement text fixtures, unit tests, and plain-text ingestion.
 * Accurately calculates running balances to distinguish debits from credits when column
 * positioning is flattened into plain text.
 */
export function parseBiStatementText(text: string): {
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
} {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const { year, month } = extractStatementPeriod(text);
  const transactions: Transaction[] = [];
  const debugLogs: PDFDebugLog[] = [];
  let skippedRowsCount = 0;
  let totalAmount = 0;
  let runningSaldo: number | null = null;

  for (const line of lines) {
    // Balance forward marker: ****SALDO ANTERIOR**** 11,030.00
    const saldoAntMatch = line.match(
      /\*{3,4}\s*SALDO\s+ANTERIOR\s*\*{3,4}\s*([\d,]+\.\d{2})/i
    );
    if (saldoAntMatch) {
      runningSaldo = parseFloat(saldoAntMatch[1].replace(/,/g, ""));
      skippedRowsCount++;
      continue;
    }

    // Case 1: Three amounts at end of line (Día, Doc, Desc, Débito, Crédito, Saldo)
    const threeAmounts = line.match(
      /^(\d{2})\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/
    );
    if (threeAmounts) {
      const [, day, , rawDesc, debStr, credStr, saldoStr] = threeAmounts;
      const debVal = parseFloat(debStr.replace(/,/g, ""));
      const credVal = parseFloat(credStr.replace(/,/g, ""));
      const saldoVal = parseFloat(saldoStr.replace(/,/g, ""));
      runningSaldo = saldoVal;

      if (debVal > 0 && !isNonExpenseBiLine(rawDesc)) {
        const isoDate = `${year}-${month}-${day}`;
        const cleanDesc = cleanBiDescription(rawDesc);
        totalAmount += debVal;
        transactions.push({
          id: `tx_bi_txt_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          date: isoDate,
          description: cleanDesc,
          amount: Number(debVal.toFixed(2)),
          currency: "GTQ",
          originalCurrency: "GTQ",
          originalAmount: Number(debVal.toFixed(2)),
          classificationSource: "local",
          category: null,
        });
      } else {
        skippedRowsCount++;
        if (credVal > 0) {
          debugLogs.push({
            type: "credit_or_payment",
            date: `${year}-${month}-${day}`,
            description: rawDesc,
            amount: `Q ${credStr}`,
          });
        }
      }
      continue;
    }

    // Case 2: Two amounts at end of line (Día, Doc, Desc, Amount, Saldo)
    const twoAmounts = line.match(
      /^(\d{2})\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/
    );
    if (twoAmounts) {
      const [, day, , rawDesc, val1Str, val2Str] = twoAmounts;
      const val1 = parseFloat(val1Str.replace(/,/g, ""));
      const val2 = parseFloat(val2Str.replace(/,/g, ""));

      let isDebit = false;
      if (runningSaldo !== null) {
        // If Previous Saldo - Val1 == New Saldo => Debit
        if (Math.abs(runningSaldo - val1 - val2) < 0.05) {
          isDebit = true;
          runningSaldo = val2;
        } else if (Math.abs(runningSaldo + val1 - val2) < 0.05) {
          // Previous Saldo + Val1 == New Saldo => Credit
          isDebit = false;
          runningSaldo = val2;
        } else {
          isDebit = !isNonExpenseBiLine(rawDesc) && !rawDesc.toLowerCase().includes("credito");
          runningSaldo = val2;
        }
      } else {
        isDebit = !isNonExpenseBiLine(rawDesc) && !rawDesc.toLowerCase().includes("credito");
      }

      if (isDebit && !isNonExpenseBiLine(rawDesc) && val1 > 0) {
        const isoDate = `${year}-${month}-${day}`;
        const cleanDesc = cleanBiDescription(rawDesc);
        totalAmount += val1;
        transactions.push({
          id: `tx_bi_txt_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          date: isoDate,
          description: cleanDesc,
          amount: Number(val1.toFixed(2)),
          currency: "GTQ",
          originalCurrency: "GTQ",
          originalAmount: Number(val1.toFixed(2)),
          classificationSource: "local",
          category: null,
        });
      } else {
        skippedRowsCount++;
        debugLogs.push({
          type: "credit_or_payment",
          date: `${year}-${month}-${day}`,
          description: rawDesc,
          amount: `Q ${val1Str}`,
        });
      }
      continue;
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
