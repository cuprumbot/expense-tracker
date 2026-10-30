import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  detectBankFromText,
  parsePDFStatement,
} from "./pdf-parser";
import {
  cleanCuscatlanDescription,
  normalizeCuscatlanDate,
  isNonExpenseCuscatlanLine,
  parseCuscatlanStatementText,
} from "./cuscatlan-parser";

const SAMPLE_CUSCATLAN_TEXT = `
www.tarjetascuscatlan.com.gt
Tarjeta No.: 459486******9975
RESUMEN DE PAGO
Fecha de Corte 15/10/2026
Fecha Límite de Pago 09/11/2026
Fecha de Operación Fecha de Proceso Concepto ( + ) Débitos y Compras ( - ) Créditos y Pagos
16/09/2026 17/09/2026 SUPERMERCADOS LA TORRE SAGUATEMALA GUATEMALA Q355.25
23/09/2026 25/09/2026 BUTA MAJADASGUATEMALA GUATEMALA Q363.00
30/09/2026 30/09/2026 02-09-26 DES. GASOLINERAS Q50.00
30/09/2026 30/09/2026 16-09-26 DES. SUPERMERCADOS Q50.00
09/10/2026 09/10/2026 PAGO TC BI Q582.95
Q Q718.25 Q682.95
TOTAL MOVIMIENTOS DEL MES: $ $0.00 $0.00
`;

const SAMPLE_CUSCATLAN_DUAL_CURRENCY_TEXT = `
www.tarjetascuscatlan.com.gt
Fecha de Operación Fecha de Proceso Concepto ( + ) Débitos y Compras
05/10/2026 06/10/2026 RESTAURANTE SAN MARTIN GUATEMALA Q150.00
07/10/2026 08/10/2026 AMAZON.COM*DIGITAL SEATTLE WA $20.00
08/10/2026 09/10/2026 SU PAGO - GRACIAS Q500.00
`;

describe("US-067: Banco Cuscatlán Identification", () => {
  it("identifies Banco Cuscatlán from web domains and institution keywords", () => {
    const res1 = detectBankFromText("Visite www.tarjetascuscatlan.com.gt para mas informacion");
    assert.strictEqual(res1.bankName, "Banco Cuscatlán");
    assert.strictEqual(res1.isCuscatlan, true);
    assert.strictEqual(res1.isSupported, true);

    const res2 = detectBankFromText("Estado de Cuenta - Banco Cuscatlán de Guatemala");
    assert.strictEqual(res2.bankName, "Banco Cuscatlán");
    assert.strictEqual(res2.isCuscatlan, true);
    assert.strictEqual(res2.isSupported, true);

    const res3 = detectBankFromText("Portal bancocuscatlan.com.gt banca personas");
    assert.strictEqual(res3.bankName, "Banco Cuscatlán");
    assert.strictEqual(res3.isCuscatlan, true);
  });
});

describe("US-067: Banco Cuscatlán Description Cleaning & Date Normalization", () => {
  it("normalizes Cuscatlán dates to ISO format YYYY-MM-DD", () => {
    assert.strictEqual(normalizeCuscatlanDate("16/09/2026"), "2026-09-16");
    assert.strictEqual(normalizeCuscatlanDate("01/01/2025"), "2025-01-01");
    assert.strictEqual(normalizeCuscatlanDate("25-12-2024"), "2024-12-25");
    assert.strictEqual(normalizeCuscatlanDate("invalid-date"), null);
  });

  it("cleans authorization prefixes, fused words, and location markers", () => {
    assert.strictEqual(
      cleanCuscatlanDescription("SUPERMERCADOS LA TORRE SAGUATEMALA GUATEMALA"),
      "SUPERMERCADOS LA TORRE"
    );
    assert.strictEqual(
      cleanCuscatlanDescription("BUTA MAJADASGUATEMALA GUATEMALA"),
      "BUTA MAJADAS"
    );
    assert.strictEqual(
      cleanCuscatlanDescription("COMPRA POS RESTAURANTE SAN MARTIN GUATEMALA GT"),
      "RESTAURANTE SAN MARTIN"
    );
    assert.strictEqual(
      cleanCuscatlanDescription("UBER *TRIP HELP.UBER.COM GTM"),
      "UBER *TRIP HELP.UBER.COM"
    );
  });

  it("identifies non-expense payments, discounts, and summary records", () => {
    assert.strictEqual(isNonExpenseCuscatlanLine("PAGO TC BI"), true);
    assert.strictEqual(isNonExpenseCuscatlanLine("SU PAGO - GRACIAS"), true);
    assert.strictEqual(isNonExpenseCuscatlanLine("02-09-26 DES. GASOLINERAS"), true);
    assert.strictEqual(isNonExpenseCuscatlanLine("16-09-26 DES. SUPERMERCADOS"), true);
    assert.strictEqual(isNonExpenseCuscatlanLine("CREDITO CASH BACK"), true);
    assert.strictEqual(isNonExpenseCuscatlanLine("PAGO MINIMO"), true);
    assert.strictEqual(isNonExpenseCuscatlanLine("SALDO ANTERIOR"), true);
    assert.strictEqual(isNonExpenseCuscatlanLine("SUPERMERCADOS LA TORRE"), false);
    assert.strictEqual(isNonExpenseCuscatlanLine("BUTA MAJADAS"), false);
  });
});

describe("US-067: Simulated Plain-Text Cuscatlán Statement Parsing", () => {
  it("parses simulated statement text and accurately filters out credits/payments", () => {
    const res = parseCuscatlanStatementText(SAMPLE_CUSCATLAN_TEXT);

    // 2 valid purchases:
    // 1) 16/09/2026 SUPERMERCADOS LA TORRE Q355.25
    // 2) 23/09/2026 BUTA MAJADAS Q363.00
    // Filtered: 2 discounts (DES.) and 1 payment (PAGO TC BI)
    assert.strictEqual(res.transactions.length, 2);
    assert.strictEqual(res.summary.validTransactionsCount, 2);
    assert.strictEqual(res.summary.totalAmount, 718.25);

    assert.strictEqual(res.transactions[0].date, "2026-09-16");
    assert.strictEqual(res.transactions[0].description, "SUPERMERCADOS LA TORRE");
    assert.strictEqual(res.transactions[0].amount, 355.25);
    assert.strictEqual(res.transactions[0].currency, "GTQ");

    assert.strictEqual(res.transactions[1].date, "2026-09-23");
    assert.strictEqual(res.transactions[1].description, "BUTA MAJADAS");
    assert.strictEqual(res.transactions[1].amount, 363.0);
    assert.strictEqual(res.transactions[1].currency, "GTQ");
  });

  it("handles dual-currency transactions converting USD purchases to Quetzales", () => {
    const res = parseCuscatlanStatementText(SAMPLE_CUSCATLAN_DUAL_CURRENCY_TEXT);

    // 2 valid purchases:
    // 1) RESTAURANTE SAN MARTIN: Q150.00
    // 2) AMAZON.COM*DIGITAL: $20.00 -> Q 157.00 (at default 7.85)
    // Filtered: SU PAGO - GRACIAS
    assert.strictEqual(res.transactions.length, 2);

    const usdTx = res.transactions.find((t) => t.description.includes("AMAZON"));
    assert.ok(usdTx);
    assert.strictEqual(usdTx.originalCurrency, "USD");
    assert.strictEqual(usdTx.originalAmount, 20.0);
    assert.strictEqual(usdTx.exchangeRateApplied, 7.85);
    assert.strictEqual(usdTx.amount, 157.0);
    assert.strictEqual(usdTx.currency, "GTQ");
  });
});

describe("US-067: Real Statement Verification (demo/CUSCATLAN-brolo.pdf)", () => {
  const filePath = "demo/CUSCATLAN-brolo.pdf";

  it("successfully parses demo/CUSCATLAN-brolo.pdf with exact mathematical total", async () => {
    if (!fs.existsSync(filePath)) {
      console.warn(`File ${filePath} not found, skipping real PDF verification.`);
      return;
    }

    const buf = fs.readFileSync(filePath);
    const result = await parsePDFStatement(new Uint8Array(buf));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "Banco Cuscatlán");

    // Expected exact debits from statement: Q 718.25 across 2 purchase transactions
    assert.strictEqual(result.transactions.length, 2);
    assert.strictEqual(result.summary.validTransactionsCount, 2);
    assert.strictEqual(result.summary.totalAmount, 718.25);

    const t1 = result.transactions[0];
    assert.strictEqual(t1.date, "2026-09-16");
    assert.strictEqual(t1.description, "SUPERMERCADOS LA TORRE");
    assert.strictEqual(t1.amount, 355.25);
    assert.strictEqual(t1.currency, "GTQ");
    assert.strictEqual(t1.classificationSource, "local");

    const t2 = result.transactions[1];
    assert.strictEqual(t2.date, "2026-09-23");
    assert.strictEqual(t2.description, "BUTA MAJADAS");
    assert.strictEqual(t2.amount, 363.0);
    assert.strictEqual(t2.currency, "GTQ");
    assert.strictEqual(t2.classificationSource, "local");

    // Verify debug logs captured the 3 credit/payment entries (2 discounts, 1 payment)
    const paymentLogs = result.debugLogs.filter((l) => l.type === "credit_or_payment");
    assert.strictEqual(paymentLogs.length, 3);
  });
});

