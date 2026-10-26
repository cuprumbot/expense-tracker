import { Transaction, CSVParsingSummary } from "@/types/transaction";
import { parseCurrency, convertUsdToGtq, getExchangeRate } from "@/lib/currency";
import type { PDFParserInstance, PDFDebugLog } from "@/lib/pdf-parser";

/**
 * Cleans and normalizes Banrural transaction concept/merchant strings.
 * Removes internal trailing brackets, fixes words hyphenated or split across multi-line entries,
 * normalizes abbreviations, and strips trailing location codes.
 */
export function cleanBanruralDescription(rawDesc: string): string {
  if (!rawDesc) return "";
  let desc = rawDesc.trim();

  // Strip trailing bracket e.g. [ at end of lines
  desc = desc.replace(/\s*\[\s*$/, "");

  // Fix broken hyphenated/wrapped words across lines (e.g. MON - ETARIOS -> MONETARIOS)
  desc = desc.replace(/\bMON\s*-\s*ETARIOS\b/i, "MONETARIOS");
  desc = desc.replace(/\bMON\s+ETARIOS\b/i, "MONETARIOS");
  desc = desc.replace(/\bELECTR\s*-\s*ONICA\b/i, "ELECTRONICA");
  desc = desc.replace(/\bELECTR\s+ONICA\b/i, "ELECTRONICA");
  desc = desc.replace(/\bTRANSF\s*-\s*ERENCIA\b/i, "TRANSFERENCIA");
  desc = desc.replace(/\bTRANSF\s+ERENCIA\b/i, "TRANSFERENCIA");

  // Normalize common bank abbreviations
  desc = desc.replace(/\bN\/DEBITO\b/i, "NOTA DEBITO");
  desc = desc.replace(/\bN\/CREDITO\b/i, "NOTA CREDITO");

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
 * Identifies whether a line is a deposit, family remittance, credit refund, interest payment,
 * card payment, or non-expense statement summary line.
 */
export function isNonExpenseBanruralLine(description: string): boolean {
  const normalized = description.toLowerCase().trim();

  // Deposits, remittances, and credit adjustments
  if (
    normalized.includes("deposito") ||
    normalized.includes("depósito") ||
    normalized.includes("remesa") ||
    normalized.includes("nota credito") ||
    normalized.includes("n/credito") ||
    normalized.includes("credito") ||
    normalized.includes("crédito") ||
    normalized.includes("intereses ganados") ||
    normalized.includes("interes capitalizado") ||
    normalized.includes("transferencia entrante")
  ) {
    return true;
  }

  // Credit card or loan payments
  if (
    normalized.includes("pago a tarjeta") ||
    normalized.includes("pago de tarjeta") ||
    normalized.includes("pago tarjeta") ||
    normalized.includes("pago por internet") ||
    normalized.includes("pago en linea") ||
    normalized.includes("pago contado")
  ) {
    return true;
  }

  // Summary and balance markers
  if (
    normalized.includes("saldo inicial") ||
    normalized.includes("saldo final") ||
    normalized.includes("total debitos") ||
    normalized.includes("total débitos") ||
    normalized.includes("total creditos") ||
    normalized.includes("total créditos") ||
    normalized.includes("resumen") ||
    normalized.includes("pagina") ||
    normalized.includes("página")
  ) {
    return true;
  }

  return false;
}

/**
 * Coordinate-aware extractor for Banrural PDF statements.
 * Supports accounts (monetarias/ahorro) and handles two-line transaction records
 * where concept descriptions wrap and amounts appear on continuation rows.
 *
 * Coordinates in Banrural statements:
 * - Date: x ~ 50-70 (starts at x ~ 55)
 * - Agency: x ~ 90-110
 * - Description: x ~ 120-260
 * - Document/Reference: x ~ 260-275
 * - Débito (expenses): 320 <= x < 370 (typically x ~ 337-342)
 * - Crédito (deposits/payments): 370 <= x < 420 (typically x ~ 389-394)
 * - Saldo: x >= 420 (typically x ~ 441-445)
 */
export async function extractBanruralTransactionsFromParser(
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

    // Sort Y descending (top of page to bottom of page)
    const sortedY = Array.from(linesByY.keys()).sort((a, b) => b - a);
    const processedLines: { y: number; items: { str: string; x: number }[] }[] = [];
    for (const y of sortedY) {
      const items = linesByY.get(y)!.sort((a, b) => a.x - b.x);
      processedLines.push({ y, items });
    }

    for (let i = 0; i < processedLines.length; i++) {
      const line = processedLines[i];
      const firstItem = line.items[0];

      // Match transaction start date DD/MM/YYYY at x ~ 55
      const dateMatch = firstItem?.str.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!dateMatch || firstItem.x > 80) continue;

      const [d, mo, yr] = firstItem.str.trim().split("/");
      const isoDate = `${yr}-${mo}-${d}`;

      const descParts: string[] = [];
      let debitItem: { str: string; x: number } | undefined;
      let creditItem: { str: string; x: number } | undefined;

      // Extract description items on this line (x ~ 120-260)
      const descItems = line.items.filter((it) => it.x >= 120 && it.x < 260);
      if (descItems.length > 0) {
        descParts.push(descItems.map((it) => it.str).join(" "));
      }

      // Check amount items on this line
      const amountItems = line.items.filter(
        (it) => /^[\d,]+\.\d{2}$/.test(it.str.trim()) && it.x >= 300
      );
      debitItem = amountItems.find((it) => it.x >= 320 && it.x < 370);
      creditItem = amountItems.find((it) => it.x >= 370 && it.x < 420);

      // Handle two-line transaction records where concept wraps onto the next line
      if (i + 1 < processedLines.length) {
        const nextLine = processedLines[i + 1];
        const nextFirstItem = nextLine?.items[0];
        const isNextLineDate =
          nextFirstItem?.str.trim().match(/^\d{2}\/\d{2}\/\d{4}$/) && nextFirstItem.x < 80;

        if (nextLine && !isNextLineDate && Math.abs(line.y - nextLine.y) <= 15) {
          const nextDescItems = nextLine.items.filter((it) => it.x >= 120 && it.x < 260);
          if (nextDescItems.length > 0) {
            descParts.push(nextDescItems.map((it) => it.str).join(" "));
          }

          const nextAmountItems = nextLine.items.filter(
            (it) => /^[\d,]+\.\d{2}$/.test(it.str.trim()) && it.x >= 300
          );
          if (!debitItem) debitItem = nextAmountItems.find((it) => it.x >= 320 && it.x < 370);
          if (!creditItem) creditItem = nextAmountItems.find((it) => it.x >= 370 && it.x < 420);

          i++; // Skip continuation line
        }
      }

      const rawDesc = descParts.join(" ").trim();
      const cleanDesc = cleanBanruralDescription(rawDesc);

      // If credit (deposit, incoming transfer), log and skip
      if (!debitItem) {
        skippedRowsCount++;
        debugLogs.push({
          type: "credit_or_payment",
          date: isoDate,
          description: cleanDesc,
          amount: creditItem ? `Q ${creditItem.str}` : "N/A",
        });
        continue;
      }

      if (isNonExpenseBanruralLine(cleanDesc)) {
        skippedRowsCount++;
        continue;
      }

      const amountVal = parseFloat(debitItem.str.replace(/,/g, ""));
      if (isNaN(amountVal) || amountVal <= 0) {
        skippedRowsCount++;
        continue;
      }

      totalAmount += amountVal;
      transactions.push({
        id: `tx_br_p${p}_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
 * Coordinate-aware parser for Banrural statements directly from Uint8Array.
 */
export async function parseBanruralStatementFromBuffer(
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

  return extractBanruralTransactionsFromParser(parser, rawText);
}

/**
 * Text-based parser for Banrural statements.
 * Accurately merges two-line records and tracks running balance to distinguish debits from credits.
 */
export function parseBanruralStatementText(text: string): {
  transactions: Transaction[];
  summary: CSVParsingSummary;
  debugLogs: PDFDebugLog[];
} {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const transactions: Transaction[] = [];
  const debugLogs: PDFDebugLog[] = [];
  let skippedRowsCount = 0;
  let totalAmount = 0;

  // Extract initial saldo from header summary if present
  let runningSaldo: number | null = null;
  const summaryMatch = text.match(
    /\b\d{1,2}\/\w+\/\d{4}\s+\d{1,2}\/\w+\/\d{4}\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/i
  );
  if (summaryMatch) {
    runningSaldo = parseFloat(summaryMatch[1].replace(/,/g, ""));
  }

  // Pre-process: merge two-line transactions in text
  const mergedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (/^\d{2}\/\d{2}\/\d{4}/.test(line)) {
      // Check if line does not have two amount numbers at the end
      const hasTwoAmounts = /[\d,]+\.\d{2}\s+[\d,]+\.\d{2}$/.test(line);
      if (!hasTwoAmounts && i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (
          !/^\d{2}\/\d{2}\/\d{4}/.test(nextLine) &&
          !nextLine.toLowerCase().includes("página") &&
          !nextLine.toLowerCase().includes("pagina")
        ) {
          line = `${line} ${nextLine}`;
          i++;
        }
      }
      mergedLines.push(line);
    } else if (/^(\d{2}[-/.]\d{2}[-/.]\d{4})\s+(.+?)\s+([Q$])\s+([\d,]+\.\d{2})/.test(line)) {
      // Credit card single-line pattern
      mergedLines.push(line);
    }
  }

  for (const line of mergedLines) {
    // Format 1: Banrural Monetaria line (Date Agency Description Doc Amount Saldo)
    const match = line.match(
      /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d+)\s+(.+?)\s+(\d+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/
    );
    if (match) {
      const [, d, mo, yr, , rawDesc, , valStr, saldoStr] = match;
      const isoDate = `${yr}-${mo}-${d}`;
      const cleanDesc = cleanBanruralDescription(rawDesc);
      const val = parseFloat(valStr.replace(/,/g, ""));
      const saldo = parseFloat(saldoStr.replace(/,/g, ""));

      let isDebit = false;
      if (runningSaldo !== null) {
        if (Math.abs(runningSaldo - val - saldo) < 0.05) {
          isDebit = true;
          runningSaldo = saldo;
        } else if (Math.abs(runningSaldo + val - saldo) < 0.05) {
          isDebit = false;
          runningSaldo = saldo;
        } else {
          isDebit = !isNonExpenseBanruralLine(cleanDesc);
          runningSaldo = saldo;
        }
      } else {
        isDebit = !isNonExpenseBanruralLine(cleanDesc);
      }

      if (!isDebit || isNonExpenseBanruralLine(cleanDesc)) {
        skippedRowsCount++;
        debugLogs.push({
          type: "credit_or_payment",
          date: isoDate,
          description: cleanDesc,
          amount: `Q ${valStr}`,
        });
        continue;
      }

      totalAmount += val;
      transactions.push({
        id: `tx_br_txt_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: isoDate,
        description: cleanDesc,
        amount: Number(val.toFixed(2)),
        currency: "GTQ",
        originalCurrency: "GTQ",
        originalAmount: Number(val.toFixed(2)),
        classificationSource: "local",
        category: null,
      });
      continue;
    }

    // Format 2: Credit Card tabular layout (Date Description Q or $ Amount)
    const cardMatch = line.match(
      /^(\d{2}[-/.]\d{2}[-/.]\d{4})\s+(.+?)\s+([Q$])\s+([\d,]+\.\d{2})/
    );
    if (cardMatch) {
      const [, rawDate, rawDesc, curSym, rawAmt] = cardMatch;
      const cleanDesc = cleanBanruralDescription(rawDesc);

      if (isNonExpenseBanruralLine(cleanDesc)) {
        skippedRowsCount++;
        debugLogs.push({
          type: "credit_or_payment",
          date: rawDate,
          description: cleanDesc,
          amount: `${curSym} ${rawAmt}`,
        });
        continue;
      }

      const amtVal = parseCurrency(rawAmt);
      if (isNaN(amtVal) || amtVal <= 0) {
        skippedRowsCount++;
        continue;
      }

      const isDollar = curSym === "$";
      const rate = getExchangeRate();
      const finalAmount = isDollar ? convertUsdToGtq(amtVal, rate) : amtVal;
      const [d, mo, yr] = rawDate.split(/[-/.]/);
      const isoDate = `${yr}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;

      totalAmount += finalAmount;
      transactions.push({
        id: `tx_br_txt_${transactions.length + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: isoDate,
        description: cleanDesc,
        amount: Number(finalAmount.toFixed(2)),
        currency: "GTQ",
        classificationSource: "local",
        category: null,
        ...(isDollar
          ? {
              originalCurrency: "USD" as const,
              originalAmount: Number(amtVal.toFixed(2)),
              exchangeRateApplied: rate,
            }
          : {
              originalCurrency: "GTQ" as const,
              originalAmount: Number(amtVal.toFixed(2)),
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
