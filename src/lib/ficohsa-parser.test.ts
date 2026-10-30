import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  detectBankFromText,
  parsePDFStatement,
} from "./pdf-parser";
import {
  cleanFicohsaDescription,
  normalizeFicohsaDate,
  extractFicohsaCutoffDate,
  isNonExpenseFicohsaLine,
  parseFicohsaStatementText,
} from "./ficohsa-parser";

const SAMPLE_FICOHSA_TEXT = `
ESTADO DE CUENTA BANCO FICOHSA GUATEMALA
Período del 23/09/2026 al 23/10/2026
Consumo Operación Cmpte. Detalle Transacción Quetzales Dólares
26/09/2026 26/09/2026 082883 GRACIAS POR SU PAGO -Q3,770.71
26/09/2026 28/09/2026 PAGO AL SALDO CON PUNTOS -Q284.00
27/09/2026 29/09/2026 012756 DOMINOS SAN CRISTOBAL GUATEMALA GT Q105.00
29/09/2026 01/10/2026 068256 TACO BELL DELIVERY 2 GUATEMALA GT Q110.00
03/10/2026 05/10/2026 083583 PAIZ SAN CRISTOBAL GUATEMALA GT Q658.68
- TOTAL DE PAGOS Y CREDITOS -Q4,054.71 $0.00
+ COMPRAS Y RETIROS Q873.68 $0.00
`;

const SAMPLE_FICOHSA_DUAL_CURRENCY_TEXT = `
ESTADO DE CUENTA BANCO FICOHSA GUATEMALA
Período del 23/09/2026 al 23/10/2026
Consumo Operación Cmpte. Detalle Transacción Quetzales Dólares
28/09/2026 29/09/2026 041126 SUPERMERCADOS LA TORRE PUERTO BARRIO GTM Q250.00
02/10/2026 03/10/2026 059231 AMAZON.COM*DIGITAL SEATTLE WA $40.00
05/10/2026 06/10/2026 071982 UBER TRIP HELP.UBER.COM CA $15.50
10/10/2026 10/10/2026 C87103 GRACIAS POR SU PAGO -Q1,500.00
`;

describe("US-069: Banco FICOHSA Identification", () => {
  it("identifies Banco FICOHSA from domains, headers, and keywords", () => {
    const res1 = detectBankFromText("ESTADO DE CUENTA BANCO FICOHSA GUATEMALA");
    assert.strictEqual(res1.bankName, "Banco FICOHSA");
    assert.strictEqual(res1.isFicohsa, true);
    assert.strictEqual(res1.isSupported, true);

    const res2 = detectBankFromText("Consulte detalles en www.ficohsa.com.gt y Call Center: 23178444");
    assert.strictEqual(res2.bankName, "Banco FICOHSA");
    assert.strictEqual(res2.isFicohsa, true);
    assert.strictEqual(res2.isSupported, true);

    const res3 = detectBankFromText("Factura electrónica seguro ficohsa total disponible online");
    assert.strictEqual(res3.bankName, "Banco FICOHSA");
    assert.strictEqual(res3.isFicohsa, true);
    assert.strictEqual(res3.isSupported, true);
  });
});

describe("US-069: FICOHSA Date Extraction & Normalization", () => {
  it("extracts cut-off date from billing period text", () => {
    const cutoff = extractFicohsaCutoffDate("Período del 23/09/2026 al 23/10/2026");
    assert.strictEqual(cutoff.year, 2026);
    assert.strictEqual(cutoff.month, "10");

    const cutoff2 = extractFicohsaCutoffDate("Fecha de corte: viernes, 23 oct. 2026");
    assert.strictEqual(cutoff2.year, 2026);
    assert.strictEqual(cutoff2.month, "10");
  });

  it("normalizes DD/MM/YYYY dates to ISO YYYY-MM-DD", () => {
    assert.strictEqual(normalizeFicohsaDate("27/09/2026"), "2026-09-27");
    assert.strictEqual(normalizeFicohsaDate("03/10/2026"), "2026-10-03");
    assert.strictEqual(normalizeFicohsaDate("16-10-2026"), "2026-10-16");
    assert.strictEqual(normalizeFicohsaDate(""), null);
  });
});

describe("US-069: FICOHSA Description Cleaning & Filtering", () => {
  it("strips authorization codes, POS prefixes, and departmental suffixes", () => {
    assert.strictEqual(
      cleanFicohsaDescription("012756 DOMINOS SAN CRISTOBAL GUATEMALA GT"),
      "DOMINOS SAN CRISTOBAL"
    );
    assert.strictEqual(
      cleanFicohsaDescription("H64806 VICLASA S.A.AMATIQUE B IZABAL IZA"),
      "VICLASA S.A.AMATIQUE B"
    );
    assert.strictEqual(
      cleanFicohsaDescription("R83792 SUPERMERCADOS LA TORRE PUERTO BARRIO GTM"),
      "SUPERMERCADOS LA TORRE"
    );
    assert.strictEqual(
      cleanFicohsaDescription("F79902 RESTAURANTE HOUSTON ZACAPA ZAC"),
      "RESTAURANTE HOUSTON"
    );
    assert.strictEqual(
      cleanFicohsaDescription("040289 CHOQUITA SACATEPEQUEZ GT"),
      "CHOQUITA"
    );
    assert.strictEqual(
      cleanFicohsaDescription("COMPRA POS FARM.CRUZ VERDE S.CRIS GUATEMALACITY GT"),
      "FARM.CRUZ VERDE S.CRIS"
    );
  });

  it("identifies payments, rewards disbursements, and statement summaries", () => {
    assert.strictEqual(isNonExpenseFicohsaLine("082883 GRACIAS POR SU PAGO"), true);
    assert.strictEqual(isNonExpenseFicohsaLine("PAGO AL SALDO CON PUNTOS"), true);
    assert.strictEqual(isNonExpenseFicohsaLine("PAGO DE CONTADO"), true);
    assert.strictEqual(isNonExpenseFicohsaLine("PUNTOS DISFRUTA+"), true);
    assert.strictEqual(isNonExpenseFicohsaLine("CASH BACK"), true);
    assert.strictEqual(isNonExpenseFicohsaLine("- TOTAL DE PAGOS Y CREDITOS"), true);
    assert.strictEqual(isNonExpenseFicohsaLine("TOTAL DE TARJETA 489215XXXXXX7976"), true);
    assert.strictEqual(isNonExpenseFicohsaLine("+ COMPRAS Y RETIROS"), true);
    assert.strictEqual(isNonExpenseFicohsaLine("DOMINOS SAN CRISTOBAL"), false);
    assert.strictEqual(isNonExpenseFicohsaLine("SEGURO FICOHSA TOTAL"), false);
  });
});

describe("US-069: Simulated Plain-Text FICOHSA Statement Parsing", () => {
  it("parses simulated statement text skipping payments and calculating total", () => {
    const res = parseFicohsaStatementText(SAMPLE_FICOHSA_TEXT);

    // 3 valid purchases:
    // 1) 27/09/2026 DOMINOS SAN CRISTOBAL Q105.00
    // 2) 29/09/2026 TACO BELL DELIVERY 2 Q110.00
    // 3) 03/10/2026 PAIZ SAN CRISTOBAL Q658.68
    // Total = 105.00 + 110.00 + 658.68 = 873.68
    assert.strictEqual(res.transactions.length, 3);
    assert.strictEqual(res.summary.validTransactionsCount, 3);
    assert.strictEqual(res.summary.totalAmount, 873.68);

    assert.strictEqual(res.transactions[0].date, "2026-09-27");
    assert.strictEqual(res.transactions[0].description, "DOMINOS SAN CRISTOBAL");
    assert.strictEqual(res.transactions[0].amount, 105.0);

    assert.strictEqual(res.transactions[1].date, "2026-09-29");
    assert.strictEqual(res.transactions[1].description, "TACO BELL DELIVERY 2");
    assert.strictEqual(res.transactions[1].amount, 110.0);

    assert.strictEqual(res.transactions[2].date, "2026-10-03");
    assert.strictEqual(res.transactions[2].description, "PAIZ SAN CRISTOBAL");
    assert.strictEqual(res.transactions[2].amount, 658.68);

    // Skipped 2 payments
    assert.strictEqual(res.summary.skippedRowsCount, 2);
  });

  it("handles dual-currency transactions converting USD purchases to Quetzales", () => {
    const res = parseFicohsaStatementText(SAMPLE_FICOHSA_DUAL_CURRENCY_TEXT);

    // 3 valid expenses:
    // 1) SUPERMERCADOS LA TORRE: Q250.00
    // 2) AMAZON.COM*DIGITAL: $40.00 -> Q 314.00 (at 7.85)
    // 3) UBER TRIP: $15.50 -> Q 121.68 (at 7.85)
    // 1 payment: GRACIAS POR SU PAGO (skipped)
    assert.strictEqual(res.transactions.length, 3);

    const amazonTx = res.transactions.find((t) => t.description.includes("AMAZON"));
    assert.ok(amazonTx);
    assert.strictEqual(amazonTx.originalCurrency, "USD");
    assert.strictEqual(amazonTx.originalAmount, 40.0);
    assert.strictEqual(amazonTx.exchangeRateApplied, 7.85);
    assert.strictEqual(amazonTx.amount, 314.0);
    assert.strictEqual(amazonTx.currency, "GTQ");

    const uberTx = res.transactions.find((t) => t.description.includes("UBER"));
    assert.ok(uberTx);
    assert.strictEqual(uberTx.originalCurrency, "USD");
    assert.strictEqual(uberTx.originalAmount, 15.5);
    assert.strictEqual(uberTx.exchangeRateApplied, 7.85);
    assert.strictEqual(uberTx.amount, 121.68);
  });
});

describe("US-069: Real Statement Verification (demo/FICOHSA-brolo.pdf)", () => {
  const filePath = "demo/FICOHSA-brolo.pdf";

  it("successfully parses demo/FICOHSA-brolo.pdf with exact mathematical total", async () => {
    if (!fs.existsSync(filePath)) {
      console.warn(`File ${filePath} not found, skipping real PDF verification.`);
      return;
    }

    const buf = fs.readFileSync(filePath);
    const result = await parsePDFStatement(new Uint8Array(buf));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "Banco FICOHSA");

    // Expected exact debits from statement: Q 2,910.39 across 17 purchase transactions
    assert.strictEqual(result.transactions.length, 17);
    assert.strictEqual(result.summary.validTransactionsCount, 17);
    assert.strictEqual(result.summary.totalAmount, 2910.39);

    const firstTx = result.transactions[0];
    assert.strictEqual(firstTx.date, "2026-09-27");
    assert.strictEqual(firstTx.description, "DOMINOS SAN CRISTOBAL");
    assert.strictEqual(firstTx.amount, 105.0);

    const paizTx = result.transactions.find((t) => t.description.includes("PAIZ SAN CRISTOBAL"));
    assert.ok(paizTx);
    assert.strictEqual(paizTx.date, "2026-10-03");
    assert.strictEqual(paizTx.amount, 658.68);

    // Payments must be recorded in debugLogs
    const paymentLogs = result.debugLogs.filter((l) => l.type === "credit_or_payment");
    assert.ok(paymentLogs.length >= 2);
    assert.ok(paymentLogs.some((l) => l.description.includes("GRACIAS POR SU PAGO")));
    assert.ok(paymentLogs.some((l) => l.description.includes("PAGO AL SALDO CON PUNTOS")));
  });
});

describe("US-069: Real Statement Verification (demo/FICOHSA-chofo.pdf)", () => {
  const filePath = "demo/FICOHSA-chofo.pdf";

  it("successfully parses demo/FICOHSA-chofo.pdf with exact mathematical total", async () => {
    if (!fs.existsSync(filePath)) {
      console.warn(`File ${filePath} not found, skipping real PDF verification.`);
      return;
    }

    const buf = fs.readFileSync(filePath);
    const result = await parsePDFStatement(new Uint8Array(buf));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "Banco FICOHSA");

    // Expected exact debits from statement: 8 card purchases + 1 insurance charge = 9 transactions totaling Q 2,171.70
    assert.strictEqual(result.transactions.length, 9);
    assert.strictEqual(result.summary.validTransactionsCount, 9);
    assert.strictEqual(result.summary.totalAmount, 2171.70);

    const viclasaTx = result.transactions[0];
    assert.strictEqual(viclasaTx.date, "2026-09-17");
    assert.strictEqual(viclasaTx.description, "VICLASA S.A.AMATIQUE B");
    assert.strictEqual(viclasaTx.amount, 330.0);

    const seguroTx = result.transactions.find((t) => t.description.includes("SEGURO FICOHSA TOTAL"));
    assert.ok(seguroTx);
    assert.strictEqual(seguroTx.date, "2026-10-16");
    assert.strictEqual(seguroTx.amount, 79.99);

    // Payment must be recorded in debugLogs
    const paymentLogs = result.debugLogs.filter((l) => l.type === "credit_or_payment");
    assert.ok(paymentLogs.some((l) => l.description.includes("GRACIAS POR SU PAGO")));
  });
});

