import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  detectBankFromText,
  parsePDFStatement,
} from "./pdf-parser";
import {
  cleanBamDescription,
  normalizeBamDate,
  extractBamCutoffDate,
  isNonExpenseBamLine,
  parseBamStatementText,
} from "./bam-parser";

const SAMPLE_BAM_TEXT = `
Estado de Cuenta en Quetzales y Dólares
Bam | VISA
www.bam.com.gt
Estado de cuenta al día: 10/05/2026
Pago de Contado QTZ 2,694.69
Fecha consumo Fecha cobro Descripción movimiento Débitos / Compras Créditos / Pagos
11/04/2026 12/04/2026 CUIDADO CON EL PERRO PERI GUATEMA GT Q.308.00 Q.0.00
11/04/2026 12/04/2026 ORTODENTAL GUATEMA GT Q.300.00 Q.0.00
13/04/2026 13/04/2026 *GRACIAS PAGO VIANET* Q.0.00 Q.1,459.00
12/04/2026 14/04/2026 MUMUSO GT GUATEMA GT Q.85.00 Q.0.00
SUBTOTAL QTZ CONSUMOS Q.693.00 Q.1,459.00
`;

const SAMPLE_BAM_DUAL_CURRENCY_TEXT = `
Estado de Cuenta en Quetzales y Dólares
Bam | VISA
Estado de cuenta al día: 10/05/2026
MOVIMIENTOS EN QUETZALES
11/04/2026 12/04/2026 SUPERMERCADO LA TORRE ZONA 11 GUATEMA GT Q.250.00 Q.0.00
MOVIMIENTOS EN DOLARES
29/04/2026 30/04/2026 GOOGLE*HBO MAX STREAM SUPPORT US $13.98 $0.00
13/04/2026 13/04/2026 PAGO ELECTRONICO BAM $0.00 $13.98
SUBTOTAL USD $13.98 $13.98
`;

describe("US-070: Banco Agromercantil (BAM) Identification", () => {
  it("identifies BAM from corporate headers, domain, and institution keywords", () => {
    const res1 = detectBankFromText("Estado de Cuenta Banco Agromercantil de Guatemala");
    assert.strictEqual(res1.bankName, "Banco Agromercantil (BAM)");
    assert.strictEqual(res1.isBAM, true);
    assert.strictEqual(res1.isSupported, true);

    const res2 = detectBankFromText("Consulte detalles en www.bam.com.gt o llame al PBX");
    assert.strictEqual(res2.bankName, "Banco Agromercantil (BAM)");
    assert.strictEqual(res2.isBAM, true);
    assert.strictEqual(res2.isSupported, true);

    const res3 = detectBankFromText("Estado de Cuenta BAM Visa Infinite Internacional");
    assert.strictEqual(res3.bankName, "Banco Agromercantil (BAM)");
    assert.strictEqual(res3.isBAM, true);
    assert.strictEqual(res3.isSupported, true);
  });
});

describe("US-070: BAM Date Extraction & Normalization", () => {
  it("extracts cut-off date from statement header text", () => {
    const cutoff = extractBamCutoffDate("Estado de cuenta al día: 10/05/2026");
    assert.strictEqual(cutoff.year, 2026);
    assert.strictEqual(cutoff.month, "05");
  });

  it("normalizes DD/MM/YYYY dates to ISO format YYYY-MM-DD", () => {
    assert.strictEqual(normalizeBamDate("11/04/2026"), "2026-04-11");
    assert.strictEqual(normalizeBamDate("02/05/2026"), "2026-05-02");
    assert.strictEqual(normalizeBamDate("10-05-2026"), "2026-05-10");
  });
});

describe("US-070: BAM Description Cleaning & Non-Expense Filtering", () => {
  it("cleans cardholder names, POS markers, and regional suffixes", () => {
    assert.strictEqual(
      cleanBamDescription("*CHRISTIAN BROLO CUIDADO CON EL PERRO PERI GUATEMA GT"),
      "CUIDADO CON EL PERRO PERI"
    );
    assert.strictEqual(
      cleanBamDescription("COMPRA POS GRATTISIMO ZONA 11 GUATEMA GT"),
      "GRATTISIMO"
    );
    assert.strictEqual(
      cleanBamDescription("GOOGLE*HBO MAX STREAM SUPPORT US"),
      "GOOGLE*HBO MAX STREAM SUPPORT"
    );
  });

  it("filters card payments, loyalty points, and summary headers", () => {
    assert.strictEqual(isNonExpenseBamLine("*GRACIAS PAGO VIANET*"), true);
    assert.strictEqual(isNonExpenseBamLine("PAGO DE TARJETA"), true);
    assert.strictEqual(isNonExpenseBamLine("PAGO ELECTRONICO BAM"), true);
    assert.strictEqual(isNonExpenseBamLine("ABONO A TARJETA"), true);
    assert.strictEqual(isNonExpenseBamLine("PUNTOS BAM"), true);
    assert.strictEqual(isNonExpenseBamLine("SUBTOTAL QTZ CONSUMOS"), true);
    assert.strictEqual(isNonExpenseBamLine("PAGO DE CONTADO"), true);

    // Legitimate merchant expenses
    assert.strictEqual(isNonExpenseBamLine("CUIDADO CON EL PERRO PERI"), false);
    assert.strictEqual(isNonExpenseBamLine("ORTODENTAL"), false);
    assert.strictEqual(isNonExpenseBamLine("MUMUSO GT"), false);
  });
});

describe("US-070: Simulated Plain-Text BAM Statement Parsing", () => {
  it("parses simulated BAM statement text, skipping payments and calculating total amount", () => {
    const res = parseBamStatementText(SAMPLE_BAM_TEXT);

    // 3 valid debits:
    // 1) CUIDADO CON EL PERRO PERI: Q308.00
    // 2) ORTODENTAL: Q300.00
    // 3) MUMUSO GT: Q85.00
    // Total: Q693.00
    // Payment: *GRACIAS PAGO VIANET* is skipped into debugLogs
    assert.strictEqual(res.transactions.length, 3);
    assert.strictEqual(res.summary.validTransactionsCount, 3);
    assert.strictEqual(res.summary.totalAmount, 693.00);

    assert.strictEqual(res.transactions[0].date, "2026-04-11");
    assert.strictEqual(res.transactions[0].amount, 308.00);
    assert.strictEqual(res.transactions[0].currency, "GTQ");

    assert.strictEqual(res.transactions[1].date, "2026-04-11");
    assert.strictEqual(res.transactions[1].amount, 300.00);

    assert.strictEqual(res.transactions[2].date, "2026-04-12");
    assert.strictEqual(res.transactions[2].amount, 85.00);

    const paymentLog = res.debugLogs.find((l) => l.description.includes("GRACIAS PAGO"));
    assert.ok(paymentLog);
  });

  it("handles dual-currency statements converting USD purchases to Quetzales", () => {
    const res = parseBamStatementText(SAMPLE_BAM_DUAL_CURRENCY_TEXT);

    // 2 valid debits:
    // 1) SUPERMERCADO LA TORRE: Q250.00
    // 2) GOOGLE*HBO MAX STREAM: $13.98 -> Q 109.74 (at 7.85)
    // 1 payment: PAGO ELECTRONICO BAM (skipped)
    assert.strictEqual(res.transactions.length, 2);

    const usdTx = res.transactions.find((t) => t.description.includes("GOOGLE*HBO"));
    assert.ok(usdTx);
    assert.strictEqual(usdTx.originalCurrency, "USD");
    assert.strictEqual(usdTx.originalAmount, 13.98);
    assert.strictEqual(usdTx.currency, "GTQ");
    assert.strictEqual(usdTx.amount, 109.74);
  });
});

describe("US-070: Real Statement Verification (demo/BAM-brolo.pdf)", () => {
  const filePath = "demo/BAM-brolo.pdf";

  it("successfully parses demo/BAM-brolo.pdf with exact mathematical total", async () => {
    if (!fs.existsSync(filePath)) {
      console.warn(`File ${filePath} not found, skipping real PDF verification.`);
      return;
    }

    const buf = fs.readFileSync(filePath);
    const result = await parsePDFStatement(new Uint8Array(buf));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "Banco Agromercantil (BAM)");

    // 14 valid debit transactions matching the statement total of Q 3,302.69
    assert.strictEqual(result.transactions.length, 14);
    assert.strictEqual(result.summary.validTransactionsCount, 14);
    assert.strictEqual(result.summary.totalAmount, 3302.69);

    const firstTx = result.transactions[0];
    assert.strictEqual(firstTx.date, "2026-04-11");
    assert.strictEqual(firstTx.description, "CUIDADO CON EL PERRO PERI");
    assert.strictEqual(firstTx.amount, 308.00);

    const ortodental = result.transactions.find((t) => t.description === "ORTODENTAL");
    assert.ok(ortodental);
    assert.strictEqual(ortodental.amount, 300.00);

    // Card payment must be filtered into debugLogs
    const paymentLog = result.debugLogs.find((l) => l.description.includes("GRACIAS PAGO VIANET"));
    assert.ok(paymentLog);
    assert.strictEqual(paymentLog.amount, "Q.1,459.00");
  });
});

