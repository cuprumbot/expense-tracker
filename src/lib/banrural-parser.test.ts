import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  detectBankFromText,
  parsePDFStatement,
} from "./pdf-parser";
import {
  cleanBanruralDescription,
  isNonExpenseBanruralLine,
  parseBanruralStatementText,
} from "./banrural-parser";

const SAMPLE_BANRURAL_MONETARIA_TEXT = `
BANCO DE DESARROLLO RURAL, S.A.
ESTADO DE CUENTA
Cuenta Estandarizada: GT30BRRL01010000003663024972
Moneda: Quetzales
01/OCT/2026 31/OCT/2026 250.00 705.00 835.00 120.00
Fecha Agencia Descripción Documento Débitos Créditos Saldo
03/10/2026 200 COBRO NOTIFICACIONES MOVILES 1001 5.00 245.00
04/10/2026 201 DEPOSITO EN EFECTIVO 1002 500.00 745.00
06/10/2026 202 N/DEBITO TRANSFERENCIA ELECTR - ONICA TIF 1003 630.00 115.00
08/10/2026 203 REMESA FAMILIAR INTERNACIONAL 1004 205.00 320.00
09/10/2026 204 RETIRO DE EFECTIVO T. DEBITO - MON - ETARIOS [ 1005 200.00 120.00
Saldo Inicial: 250.00 Total Débitos: 835.00 Total Créditos: 705.00 Saldo Final: 120.00
`;

const SAMPLE_BANRURAL_TWO_LINE_TEXT = `
BANCO DE DESARROLLO RURAL, S.A.
01/OCT/2026 31/OCT/2026 500.00 0.00 500.00 0.00
Fecha Agencia Descripción Documento Débitos Créditos Saldo
05/10/2026 123 NOTA DEBITO COMPRA EN
SUPERMERCADO LA TORRE ZONA 10 998811 350.00 150.00
12/10/2026 124 PAGO SERVICIO AGUA
EMPRESA MUNICIPAL DE AGUA 998822 150.00 0.00
Total Débitos: 500.00 Total Créditos: 0.00
`;

const SAMPLE_BANRURAL_CARD_TEXT = `
BANRURAL TARJETA DE CREDITO
ESTADO DE CUENTA VISA
05/10/2026 RESTAURANTE LOS CEBOLLINES ZONA 10 Q 150.00
06/10/2026 PAGO POR INTERNET BANRURAL Q 1,200.00
10/10/2026 NETFLIX SUBSCRIPTION GTM $ 15.99
15/10/2026 SUPERMERCADOS LA TORRE Q 425.50
18/10/2026 CREDITO CASH BACK BANRURAL Q 50.00
`;

describe("US-017 & US-019: Banrural Bank Identification", () => {
  it("detects Banrural from institution name and URL keywords", () => {
    const res1 = detectBankFromText("ESTADO DE CUENTA BANRURAL QUETZALES");
    assert.strictEqual(res1.bankName, "Banrural");
    assert.strictEqual(res1.isBanrural, true);
    assert.strictEqual(res1.isSupported, true);

    const res2 = detectBankFromText("BANCO DE DESARROLLO RURAL, S.A. GUATEMALA");
    assert.strictEqual(res2.bankName, "Banrural");
    assert.strictEqual(res2.isBanrural, true);
    assert.strictEqual(res2.isSupported, true);

    const res3 = detectBankFromText("Consulte sus operaciones en www.banrural.com.gt");
    assert.strictEqual(res3.bankName, "Banrural");
    assert.strictEqual(res3.isBanrural, true);
    assert.strictEqual(res3.isSupported, true);
  });

  it("detects Banrural from standardized IBAN code with BRRL identifier", () => {
    const res = detectBankFromText("Cuenta Estandarizada: GT30BRRL01010000003663024972");
    assert.strictEqual(res.bankName, "Banrural");
    assert.strictEqual(res.isBanrural, true);
    assert.strictEqual(res.isSupported, true);
  });
});

describe("US-019: Banrural Description Cleaning", () => {
  it("strips trailing brackets and internal code delimiters", () => {
    assert.strictEqual(
      cleanBanruralDescription("RETIRO DE EFECTIVO T. DEBITO - MONETARIOS ["),
      "RETIRO DE EFECTIVO T. DEBITO - MONETARIOS"
    );
  });

  it("repairs broken hyphenated words across multi-line breaks", () => {
    assert.strictEqual(
      cleanBanruralDescription("RETIRO DE EFECTIVO T. DEBITO - MON - ETARIOS"),
      "RETIRO DE EFECTIVO T. DEBITO - MONETARIOS"
    );
    assert.strictEqual(
      cleanBanruralDescription("TRANSFERENCIA ELECTR - ONICA TIF"),
      "TRANSFERENCIA ELECTRONICA TIF"
    );
    assert.strictEqual(
      cleanBanruralDescription("TRANSF - ERENCIA BANCARIA"),
      "TRANSFERENCIA BANCARIA"
    );
  });

  it("normalizes common bank abbreviations", () => {
    assert.strictEqual(
      cleanBanruralDescription("N/DEBITO TRANSFERENCIA ELECTRONICA"),
      "NOTA DEBITO TRANSFERENCIA ELECTRONICA"
    );
    assert.strictEqual(
      cleanBanruralDescription("N/CREDITO REEMBOLSO"),
      "NOTA CREDITO REEMBOLSO"
    );
  });

  it("strips address strings following backslash and country code tokens", () => {
    assert.strictEqual(
      cleanBanruralDescription("SUPERMERCADO LA TORRE\\CALZADA ROOSEVELT GTM"),
      "SUPERMERCADO LA TORRE"
    );
    assert.strictEqual(
      cleanBanruralDescription("FARMACIA GALENO GUA"),
      "FARMACIA GALENO"
    );
  });
});

describe("US-019: Non-Expense Filtering for Banrural", () => {
  it("identifies deposits, remittances, and credit adjustments as non-expenses", () => {
    assert.strictEqual(isNonExpenseBanruralLine("DEPOSITO EN EFECTIVO"), true);
    assert.strictEqual(isNonExpenseBanruralLine("REMESA FAMILIAR INTERNACIONAL"), true);
    assert.strictEqual(isNonExpenseBanruralLine("INTERESES GANADOS"), true);
    assert.strictEqual(isNonExpenseBanruralLine("NOTA CREDITO AJUSTE"), true);
    assert.strictEqual(isNonExpenseBanruralLine("PAGO A TARJETA"), true);
    assert.strictEqual(isNonExpenseBanruralLine("PAGO POR INTERNET"), true);
  });

  it("identifies header summary markers as non-expenses", () => {
    assert.strictEqual(isNonExpenseBanruralLine("Saldo Inicial: 250.00"), true);
    assert.strictEqual(isNonExpenseBanruralLine("Total Débitos: 835.00"), true);
    assert.strictEqual(isNonExpenseBanruralLine("Total Créditos: 705.00"), true);
    assert.strictEqual(isNonExpenseBanruralLine("Página 1 de 1"), true);
  });

  it("correctly identifies valid debit expenses as not non-expenses", () => {
    assert.strictEqual(isNonExpenseBanruralLine("COBRO NOTIFICACIONES MOVILES"), false);
    assert.strictEqual(isNonExpenseBanruralLine("NOTA DEBITO TRANSFERENCIA ELECTRONICA"), false);
    assert.strictEqual(isNonExpenseBanruralLine("RETIRO DE EFECTIVO T. DEBITO - MONETARIOS"), false);
    assert.strictEqual(isNonExpenseBanruralLine("SUPERMERCADO LA TORRE"), false);
  });
});

describe("US-019: Text-based Banrural Statement Parsing", () => {
  it("extracts debit transactions and filters out credits from monetaria layout", () => {
    const res = parseBanruralStatementText(SAMPLE_BANRURAL_MONETARIA_TEXT);
    assert.strictEqual(res.transactions.length, 3);
    assert.strictEqual(res.summary.validTransactionsCount, 3);
    assert.strictEqual(res.summary.totalAmount, 835.00);

    const [tx1, tx2, tx3] = res.transactions;
    assert.strictEqual(tx1.date, "2026-10-03");
    assert.strictEqual(tx1.description, "COBRO NOTIFICACIONES MOVILES");
    assert.strictEqual(tx1.amount, 5.00);
    assert.strictEqual(tx1.classificationSource, "local");

    assert.strictEqual(tx2.date, "2026-10-06");
    assert.strictEqual(tx2.description, "NOTA DEBITO TRANSFERENCIA ELECTRONICA TIF");
    assert.strictEqual(tx2.amount, 630.00);

    assert.strictEqual(tx3.date, "2026-10-09");
    assert.strictEqual(tx3.description, "RETIRO DE EFECTIVO T. DEBITO - MONETARIOS");
    assert.strictEqual(tx3.amount, 200.00);

    // Two credits (DEPOSITO 500, REMESA 205) should be skipped
    assert.strictEqual(res.summary.skippedRowsCount >= 2, true);
  });

  it("correctly merges two-line transaction records in statement text", () => {
    const res = parseBanruralStatementText(SAMPLE_BANRURAL_TWO_LINE_TEXT);
    assert.strictEqual(res.transactions.length, 2);
    assert.strictEqual(res.summary.totalAmount, 500.00);

    const [tx1, tx2] = res.transactions;
    assert.strictEqual(tx1.date, "2026-10-05");
    assert.strictEqual(
      tx1.description,
      "NOTA DEBITO COMPRA EN SUPERMERCADO LA TORRE ZONA 10"
    );
    assert.strictEqual(tx1.amount, 350.00);

    assert.strictEqual(tx2.date, "2026-10-12");
    assert.strictEqual(
      tx2.description,
      "PAGO SERVICIO AGUA EMPRESA MUNICIPAL DE AGUA"
    );
    assert.strictEqual(tx2.amount, 150.00);
  });

  it("extracts and converts credit card transactions with USD conversion", () => {
    const res = parseBanruralStatementText(SAMPLE_BANRURAL_CARD_TEXT);
    // Should filter PAGO POR INTERNET (payment) and CREDITO CASH BACK (refund)
    assert.strictEqual(res.transactions.length, 3);

    const txUsd = res.transactions.find((tx) => tx.originalCurrency === "USD");
    assert.ok(txUsd, "Should extract USD transaction");
    assert.strictEqual(txUsd?.description, "NETFLIX SUBSCRIPTION");
    assert.strictEqual(txUsd?.originalAmount, 15.99);
    assert.strictEqual(txUsd?.currency, "GTQ");
    assert.strictEqual(txUsd?.amount, Number((15.99 * 7.85).toFixed(2)));
  });
});

describe("US-019 & US-017: Real Reference PDF Statements (demo/BANRURAL-2026-xx.pdf)", () => {
  const banruralPdfPath = "demo/BANRURAL-2026-10.pdf";

  it("parses demo/BANRURAL-2026-10.pdf through parsePDFStatement with zero LLM", async () => {
    if (!fs.existsSync(banruralPdfPath)) {
      console.warn(`File ${banruralPdfPath} does not exist, skipping file test.`);
      return;
    }

    const buffer = fs.readFileSync(banruralPdfPath);
    const result = await parsePDFStatement(new Uint8Array(buffer));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "Banrural");

    // Must match the exact debits from the statement
    // Total debits according to PDF header: 835.00
    // Exactly 3 debits:
    // 1. 03/10/2026 | COBRO NOTIFICACIONES MOVILES | Q 5.00
    // 2. 06/10/2026 | NOTA DEBITO TRANSFERENCIA ELECTRONICA TIF | Q 630.00
    // 3. 09/10/2026 | RETIRO DE EFECTIVO T. DEBITO - MONETARIOS | Q 200.00
    assert.strictEqual(result.transactions.length, 3);
    assert.strictEqual(result.summary.validTransactionsCount, 3);
    assert.strictEqual(result.summary.totalAmount, 835.00);

    const [tx1, tx2, tx3] = result.transactions;
    assert.strictEqual(tx1.date, "2026-10-03");
    assert.strictEqual(tx1.description, "COBRO NOTIFICACIONES MOVILES");
    assert.strictEqual(tx1.amount, 5.00);
    assert.strictEqual(tx1.currency, "GTQ");
    assert.strictEqual(tx1.classificationSource, "local");

    assert.strictEqual(tx2.date, "2026-10-06");
    assert.strictEqual(tx2.description, "NOTA DEBITO TRANSFERENCIA ELECTRONICA TIF");
    assert.strictEqual(tx2.amount, 630.00);
    assert.strictEqual(tx2.currency, "GTQ");

    assert.strictEqual(tx3.date, "2026-10-09");
    assert.strictEqual(tx3.description, "RETIRO DE EFECTIVO T. DEBITO - MONETARIOS");
    assert.strictEqual(tx3.amount, 200.00);
    assert.strictEqual(tx3.currency, "GTQ");

    // Check credits were skipped and logged into debugLogs
    assert.strictEqual(result.summary.skippedRowsCount, 3);
    assert.strictEqual(result.debugLogs.length, 3);
  });
});
