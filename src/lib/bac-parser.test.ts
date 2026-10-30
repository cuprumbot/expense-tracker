import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  detectBankFromText,
  parsePDFStatement,
} from "./pdf-parser";
import {
  cleanBacDescription,
  normalizeBacDate,
  extractBacCutoffDate,
  isNonExpenseBacLine,
  parseBacStatementText,
} from "./bac-parser";

const SAMPLE_BAC_TEXT = `
BAC CREDOMATIC
ESTADO DE CUENTA TARJETA DE CRÉDITO
FECHA DE CORTE: 15-OCT-2026
LÍMITE DE CRÉDITO: Q 15,000.00
SEP/16 SEP/16 PAGO RECIBIDO...240 Q658.31-
SEP/21 SEP/21 PAIZ SAN CRISTOBAL -VN- Q797.75
OCT/11 OCT/11 PAIZ SAN CRISTOBAL -VN- Q42.50
DÉBITO Q840.25 CRÉDITO Q658.31-
`;

const SAMPLE_BAC_DUAL_CURRENCY_TEXT = `
BAC CREDOMATIC
FECHA DE CORTE: 15-OCT-2026
SEP/21 SEP/21 SUPERMERCADO LA TORRE Q250.00
SEP/25 SEP/26 AMAZON.COM*SERVICES $30.00
OCT/01 OCT/02 TASA CERO 01/03 TIENDA MAX Q400.00
OCT/10 OCT/10 PAGO BANCA EN LINEA Q1000.00-
`;

describe("US-068: BAC Credomatic Identification", () => {
  it("identifies BAC Credomatic from domains, headers, and keywords", () => {
    const res1 = detectBankFromText("Visite www.baccredomatic.com para gestionar sus cuentas");
    assert.strictEqual(res1.bankName, "BAC Credomatic");
    assert.strictEqual(res1.isBac, true);
    assert.strictEqual(res1.isSupported, true);

    const res2 = detectBankFromText("ESTADO DE CUENTA BAC CREDOMATIC GUATEMALA");
    assert.strictEqual(res2.bankName, "BAC Credomatic");
    assert.strictEqual(res2.isBac, true);
    assert.strictEqual(res2.isSupported, true);

    const res3 = detectBankFromText("Notificaciones servicio al cliente: contacto@baccredomatic.gt");
    assert.strictEqual(res3.bankName, "BAC Credomatic");
    assert.strictEqual(res3.isBac, true);
    assert.strictEqual(res3.isSupported, true);

    const res4 = detectBankFromText("Servicios de adquirencia Credomatic de Guatemala");
    assert.strictEqual(res4.bankName, "BAC Credomatic");
    assert.strictEqual(res4.isBac, true);
    assert.strictEqual(res4.isSupported, true);
  });
});

describe("US-068: BAC Date Extraction and Normalization", () => {
  it("extracts statement cut-off year and month from raw text", () => {
    const cutoff1 = extractBacCutoffDate("FECHA DE CORTE 15-OCT-2026");
    assert.strictEqual(cutoff1.year, 2026);
    assert.strictEqual(cutoff1.month, "10");

    const cutoff2 = extractBacCutoffDate("CORTE: 28-FEB-2025");
    assert.strictEqual(cutoff2.year, 2025);
    assert.strictEqual(cutoff2.month, "02");
  });

  it("normalizes MMM/DD, DD/MMM, and DD/MM/YYYY dates to ISO format", () => {
    assert.strictEqual(normalizeBacDate("SEP/21", 2026, "10"), "2026-09-21");
    assert.strictEqual(normalizeBacDate("OCT/11", 2026, "10"), "2026-10-11");
    assert.strictEqual(normalizeBacDate("21/SEP", 2026, "10"), "2026-09-21");
    assert.strictEqual(normalizeBacDate("15/10/2026", 2026, "10"), "2026-10-15");
    assert.strictEqual(normalizeBacDate("invalid", 2026, "10"), null);
  });

  it("rolls back to previous year when transaction month is greater than cutoff month", () => {
    // If cut-off is January 2026, a transaction in December belongs to 2025
    assert.strictEqual(normalizeBacDate("DEC/20", 2026, "01"), "2025-12-20");
    assert.strictEqual(normalizeBacDate("DIC/15", 2026, "01"), "2025-12-15");
  });
});

describe("US-068: BAC Description Cleaning & Non-Expense Filtering", () => {
  it("cleans internal tags, masked references, and location markers", () => {
    assert.strictEqual(
      cleanBacDescription("PAIZ SAN CRISTOBAL -VN-"),
      "PAIZ SAN CRISTOBAL"
    );
    assert.strictEqual(
      cleanBacDescription("COMPRA POS RESTAURANTE EL PORTAL CIUDAD DE GUATEMALA"),
      "RESTAURANTE EL PORTAL"
    );
    assert.strictEqual(
      cleanBacDescription("PAGO RECIBIDO...240"),
      "PAGO RECIBIDO"
    );
    assert.strictEqual(
      cleanBacDescription("SUPERMERCADO LA TORRE -VC- GUATEMALA GT"),
      "SUPERMERCADO LA TORRE"
    );
    assert.strictEqual(
      cleanBacDescription("ESTABLECIMIENTO AMEX BAC"),
      "ESTABLECIMIENTO"
    );
  });

  it("filters card payments, loyalty cashback, and summaries", () => {
    assert.strictEqual(isNonExpenseBacLine("PAGO RECIBIDO...240"), true);
    assert.strictEqual(isNonExpenseBacLine("SU PAGO EN EFECTIVO"), true);
    assert.strictEqual(isNonExpenseBacLine("PAGO BANCA EN LINEA"), true);
    assert.strictEqual(isNonExpenseBacLine("WALMART CASH"), true);
    assert.strictEqual(isNonExpenseBacLine("PUNTOS CANJEABLES"), true);
    assert.strictEqual(isNonExpenseBacLine("CREDITO CASH BACK"), true);
    assert.strictEqual(isNonExpenseBacLine("SALDO ANTERIOR"), true);
    assert.strictEqual(isNonExpenseBacLine("DÉBITO"), true);
    assert.strictEqual(isNonExpenseBacLine("CRÉDITO"), true);
  });

  it("preserves installment plans as valid expenses", () => {
    assert.strictEqual(isNonExpenseBacLine("BAC CUOTAS 02/06 ELEKTRA"), false);
    assert.strictEqual(isNonExpenseBacLine("TASA CERO 01/03 TIENDA MAX"), false);
    assert.strictEqual(isNonExpenseBacLine("CUOTAS SIN INTERESES PRIDERA"), false);
    assert.strictEqual(isNonExpenseBacLine("PAIZ SAN CRISTOBAL"), false);
  });
});

describe("US-068: Simulated Plain-Text BAC Statement Parsing", () => {
  it("parses simulated statement text, skipping payments and calculating total amount", () => {
    const res = parseBacStatementText(SAMPLE_BAC_TEXT);

    // 2 valid purchases:
    // 1) 21/SEP PAIZ SAN CRISTOBAL Q797.75
    // 2) 11/OCT PAIZ SAN CRISTOBAL Q42.50
    // Payment (PAGO RECIBIDO...240 Q658.31-) must be filtered out
    assert.strictEqual(res.transactions.length, 2);
    assert.strictEqual(res.summary.validTransactionsCount, 2);
    assert.strictEqual(res.summary.totalAmount, 840.25);

    assert.strictEqual(res.transactions[0].date, "2026-09-21");
    assert.strictEqual(res.transactions[0].description, "PAIZ SAN CRISTOBAL");
    assert.strictEqual(res.transactions[0].amount, 797.75);
    assert.strictEqual(res.transactions[0].currency, "GTQ");

    assert.strictEqual(res.transactions[1].date, "2026-10-11");
    assert.strictEqual(res.transactions[1].description, "PAIZ SAN CRISTOBAL");
    assert.strictEqual(res.transactions[1].amount, 42.5);
    assert.strictEqual(res.transactions[1].currency, "GTQ");

    // Check debug log contains skipped payment
    const paymentLog = res.debugLogs.find((l) => l.description.includes("PAGO RECIBIDO"));
    assert.ok(paymentLog);
  });

  it("handles dual-currency transactions converting USD purchases to Quetzales", () => {
    const res = parseBacStatementText(SAMPLE_BAC_DUAL_CURRENCY_TEXT);

    // 3 valid expenses:
    // 1) SUPERMERCADO LA TORRE: Q250.00
    // 2) AMAZON.COM*SERVICES: $30.00 -> Q 235.50 (at 7.85)
    // 3) TASA CERO 01/03 TIENDA MAX: Q400.00
    // 1 payment: PAGO BANCA EN LINEA (skipped)
    assert.strictEqual(res.transactions.length, 3);

    const usdTx = res.transactions.find((t) => t.description.includes("AMAZON"));
    assert.ok(usdTx);
    assert.strictEqual(usdTx.originalCurrency, "USD");
    assert.strictEqual(usdTx.originalAmount, 30.0);
    assert.strictEqual(usdTx.exchangeRateApplied, 7.85);
    assert.strictEqual(usdTx.amount, 235.5);
    assert.strictEqual(usdTx.currency, "GTQ");

    const installmentTx = res.transactions.find((t) => t.description.includes("TASA CERO"));
    assert.ok(installmentTx);
    assert.strictEqual(installmentTx.amount, 400.0);
  });
});

describe("US-068: Real Statement Verification (demo/BAC-brolo.pdf)", () => {
  const filePath = "demo/BAC-brolo.pdf";

  it("successfully parses demo/BAC-brolo.pdf with exact mathematical total", async () => {
    if (!fs.existsSync(filePath)) {
      console.warn(`File ${filePath} not found, skipping real PDF verification.`);
      return;
    }

    const buf = fs.readFileSync(filePath);
    const result = await parsePDFStatement(new Uint8Array(buf));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "BAC Credomatic");

    // Expected exact debits from statement: Q 840.25 across 2 purchase transactions
    assert.strictEqual(result.transactions.length, 2);
    assert.strictEqual(result.summary.validTransactionsCount, 2);
    assert.strictEqual(result.summary.totalAmount, 840.25);

    const t1 = result.transactions[0];
    assert.strictEqual(t1.date, "2026-09-21");
    assert.strictEqual(t1.description, "PAIZ SAN CRISTOBAL");
    assert.strictEqual(t1.amount, 797.75);
    assert.strictEqual(t1.currency, "GTQ");

    const t2 = result.transactions[1];
    assert.strictEqual(t2.date, "2026-10-11");
    assert.strictEqual(t2.description, "PAIZ SAN CRISTOBAL");
    assert.strictEqual(t2.amount, 42.5);
    assert.strictEqual(t2.currency, "GTQ");

    // Payment must be excluded and recorded in debugLogs
    assert.strictEqual(result.summary.skippedRowsCount, 1);
    const paymentLog = result.debugLogs.find((l) => l.type === "credit_or_payment");
    assert.ok(paymentLog);
    assert.strictEqual(paymentLog.amount, "658.31-");
    assert.ok(paymentLog.description.includes("PAGO RECIBIDO"));
  });
});
