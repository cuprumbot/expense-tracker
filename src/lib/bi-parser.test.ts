import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  detectBankFromText,
  parsePDFStatement,
} from "./pdf-parser";
import {
  cleanBiDescription,
  extractStatementPeriod,
  isNonExpenseBiLine,
  normalizeBiDate,
  parseBiStatementText,
} from "./bi-parser";

const SAMPLE_BI_STATEMENT_TEXT = `
ESTADO DE CUENTA BANCO INDUSTRIAL
XXXX XXXX XXXX 1118 MC GOLD INTERNACIONAL
Fecha de corte: 16 10 2026
Fecha de pago: 10 11 2026
MOVIMIENTOS EN QUETZALES
Fecha de operación Fecha de consumo Descripción Débitos Créditos
15/09/2026 14/09/2026 SUPERMERCADOS LA TORRE GUATEMALA GTM 350.00 .00
18/09/2026 17/09/2026 COMPRA POS RESTAURANTE EL PORTAL GT 120.50 .00
28/09/2026 28/09/2026 GRACIAS POR SU PAGO .00 500.00
12/10/2026 12/10/2026 INTERESES POR FINANCIAMIENTO SOBRE/ 111.78 .00
TOTAL QUETZALES 582.28 500.00
`;

const SAMPLE_BI_DUAL_CURRENCY_TEXT = `
ESTADO DE CUENTA BANCO INDUSTRIAL
Fecha de corte: 16 10 2026
MOVIMIENTOS EN QUETZALES
15/09/2026 14/09/2026 FARMACIA GALENO ZONA 10 Q200.00 .00
MOVIMIENTOS EN DOLARES
20/09/2026 19/09/2026 AMAZON.COM*SERVICES SEATTLE WA $30.00 .00
25/09/2026 25/09/2026 PAGO POR BI EN LINEA .00 $30.00
TOTAL DOLARES 30.00 30.00
`;

describe("US-017 & US-064: Multi-Bank Identification & Scope Engine", () => {
  it("identifies Banco Industrial from corporate headers and SWIFT keywords", () => {
    const r1 = detectBankFromText("Estado de cuenta Banco Industrial, S.A.");
    assert.strictEqual(r1.bankName, "Banco Industrial");
    assert.strictEqual(r1.isBI, true);
    assert.strictEqual(r1.isSupported, true);

    const r2 = detectBankFromText("Acceso a Bi en Línea corporacion bi");
    assert.strictEqual(r2.bankName, "Banco Industrial");
    assert.strictEqual(r2.isBI, true);
    assert.strictEqual(r2.isSupported, true);

    const r3 = detectBankFromText("Cuenta GT75 INDL 0101 0000 0006");
    assert.strictEqual(r3.bankName, "Banco Industrial");
    assert.strictEqual(r3.isBI, true);

    const r4 = detectBankFromText("Servicios en línea bi.com.gt club bi");
    assert.strictEqual(r4.bankName, "Banco Industrial");
    assert.strictEqual(r4.isBI, true);
  });

  it("identifies Banco G&T Continental from keywords", () => {
    const res = detectBankFromText("Banco G&T Continental www.gtc.com.gt");
    assert.strictEqual(res.bankName, "Banco G&T Continental");
    assert.strictEqual(res.isGyT, true);
    assert.strictEqual(res.isSupported, true);
  });

  it("US-064: flags Banrural statements as unsupported (falls back to anonymization)", () => {
    const rBanrural = detectBankFromText("Estado de cuenta Banrural www.banrural.com.gt");
    assert.strictEqual(rBanrural.bankName, "Banrural");
    assert.strictEqual(rBanrural.isBanrural, true);
    assert.strictEqual(rBanrural.isSupported, false);

    const rBam = detectBankFromText("Banco Agromercantil BAM de Guatemala");
    assert.strictEqual(rBam.bankName, "Banco Agromercantil (BAM)");
    assert.strictEqual(rBam.isBAM, true);
  });

  it("correctly flags unsupported banks", () => {
    const res = detectBankFromText("Banco Desconocido Internacional de Inversiones");
    assert.strictEqual(res.bankName, "Banco no identificado");
    assert.strictEqual(res.isSupported, false);
  });
});

describe("US-064 & US-066: Banco Industrial Shared Description Cleaning & Period Parsing", () => {
  it("extracts statement period from Spanish month abbreviations", () => {
    assert.deepStrictEqual(extractStatementPeriod("JIMENEZ LUIS ABRIL/25"), {
      year: "2025",
      month: "04",
    });
    assert.deepStrictEqual(extractStatementPeriod("PERIODO AGOSTO/2026"), {
      year: "2026",
      month: "08",
    });
    assert.deepStrictEqual(extractStatementPeriod("FECHA: 15/09/2024"), {
      year: "2024",
      month: "09",
    });
    assert.deepStrictEqual(extractStatementPeriod("Fecha de corte: 16 10 2026"), {
      year: "2026",
      month: "10",
    });
  });

  it("normalizes 2-digit and 4-digit year dates to ISO YYYY-MM-DD", () => {
    assert.strictEqual(normalizeBiDate("12/10/26", 2026, "10"), "2026-10-12");
    assert.strictEqual(normalizeBiDate("14/09/2026", 2026, "10"), "2026-09-14");
    assert.strictEqual(normalizeBiDate("05-10-26", 2026, "10"), "2026-10-05");
    // Year rollover: if cutoff is Jan 2026, December tx belongs to 2025
    assert.strictEqual(normalizeBiDate("15/12/26", 2026, "01"), "2025-12-15");
  });

  it("cleans POS codes, ATM prefixes, and location tags", () => {
    assert.strictEqual(
      cleanBiDescription("NOTA DEBITO ATM 183 AGENCIA UNIVERSIDA G"),
      "ATM 183 AGENCIA UNIVERSIDA G"
    );
    assert.strictEqual(
      cleanBiDescription("NOTA DEBITO SERBIPAGO"),
      "SERBIPAGO"
    );
    assert.strictEqual(
      cleanBiDescription("NOTA DEBITO BANCA MOVIL"),
      "BANCA MOVIL"
    );
    assert.strictEqual(
      cleanBiDescription("POS BI LA TORRE ZONA 10 GTM"),
      "LA TORRE ZONA 10"
    );
    assert.strictEqual(
      cleanBiDescription("POLLO CAMPERO\\AVE PETAPA 31 GTM"),
      "POLLO CAMPERO"
    );
    assert.strictEqual(
      cleanBiDescription("GASOLINERA PUMA GUATEMALA GUA"),
      "GASOLINERA PUMA GUATEMALA"
    );
    assert.strictEqual(
      cleanBiDescription("INTERESES POR FINANCIAMIENTO SOBRE/"),
      "INTERESES POR FINANCIAMIENTO"
    );
  });

  it("identifies non-expense card payments, refunds, and summary lines", () => {
    assert.strictEqual(isNonExpenseBiLine("GRACIAS POR SU PAGO"), true);
    assert.strictEqual(isNonExpenseBiLine("PAGO DE TARJETA"), true);
    assert.strictEqual(isNonExpenseBiLine("PAGO POR INTERNET"), true);
    assert.strictEqual(isNonExpenseBiLine("PAGO CONTADO"), true);
    assert.strictEqual(isNonExpenseBiLine("PAGO POR BI EN LINEA"), true);
    assert.strictEqual(isNonExpenseBiLine("PAGO ACH"), true);
    assert.strictEqual(isNonExpenseBiLine("CREDITO CASH BACK"), true);
    assert.strictEqual(isNonExpenseBiLine("SALDO ANTERIOR"), true);
    assert.strictEqual(isNonExpenseBiLine("PAGO MINIMO"), true);
    assert.strictEqual(isNonExpenseBiLine("TOTAL QUETZALES"), true);
    assert.strictEqual(isNonExpenseBiLine("SUPERMERCADO LA TORRE"), false);
    assert.strictEqual(isNonExpenseBiLine("RESTAURANTE SAN MARTIN"), false);
    assert.strictEqual(isNonExpenseBiLine("CARGO POR GESTION DE COBRO"), false);
  });
});

describe("US-066: Simulated Plain-Text Bi Credit Statement Parsing", () => {
  it("parses simulated statement text, skipping payments and calculating total amount", () => {
    const res = parseBiStatementText(SAMPLE_BI_STATEMENT_TEXT);

    // 3 valid debits:
    // 1) 14/09/2026 SUPERMERCADOS LA TORRE Q350.00
    // 2) 17/09/2026 RESTAURANTE EL PORTAL Q120.50
    // 3) 12/10/2026 INTERESES POR FINANCIAMIENTO Q111.78
    // Payment (28/09/2026 GRACIAS POR SU PAGO 500.00) is filtered into debugLogs
    assert.strictEqual(res.transactions.length, 3);
    assert.strictEqual(res.summary.validTransactionsCount, 3);
    assert.strictEqual(res.summary.totalAmount, 582.28);

    assert.strictEqual(res.transactions[0].date, "2026-09-14");
    assert.strictEqual(res.transactions[0].description, "SUPERMERCADOS LA TORRE");
    assert.strictEqual(res.transactions[0].amount, 350.0);

    assert.strictEqual(res.transactions[1].date, "2026-09-17");
    assert.strictEqual(res.transactions[1].description, "RESTAURANTE EL PORTAL");
    assert.strictEqual(res.transactions[1].amount, 120.5);

    assert.strictEqual(res.transactions[2].date, "2026-10-12");
    assert.strictEqual(res.transactions[2].description, "INTERESES POR FINANCIAMIENTO");
    assert.strictEqual(res.transactions[2].amount, 111.78);

    // Payment logged in debugLogs
    const paymentLog = res.debugLogs.find((l) => l.description.includes("GRACIAS POR SU PAGO"));
    assert.ok(paymentLog);
  });

  it("handles dual-currency transactions converting USD purchases to Quetzales", () => {
    const res = parseBiStatementText(SAMPLE_BI_DUAL_CURRENCY_TEXT);

    // 2 valid debits:
    // 1) FARMACIA GALENO: Q200.00
    // 2) AMAZON.COM*SERVICES: $30.00 -> Q 235.50 (at 7.85)
    // 1 payment: PAGO POR BI EN LINEA (skipped)
    assert.strictEqual(res.transactions.length, 2);

    const usdTx = res.transactions.find((t) => t.description.includes("AMAZON"));
    assert.ok(usdTx);
    assert.strictEqual(usdTx.originalCurrency, "USD");
    assert.strictEqual(usdTx.originalAmount, 30.0);
    assert.strictEqual(usdTx.exchangeRateApplied, 7.85);
    assert.strictEqual(usdTx.amount, 235.5);
    assert.strictEqual(usdTx.currency, "GTQ");
  });
});

describe("US-066: Real Statement Verification (demo/BI-max.pdf)", () => {
  const filePath = "demo/BI-max.pdf";

  it("successfully parses demo/BI-max.pdf with exact mathematical total", async () => {
    if (!fs.existsSync(filePath)) {
      console.warn(`File ${filePath} not found, skipping real PDF verification.`);
      return;
    }

    const buf = fs.readFileSync(filePath);
    const result = await parsePDFStatement(new Uint8Array(buf));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "Banco Industrial");

    // Expected exact debits from statement: 2 transactions (INTERESES 111.78 + OTROS CARGOS 85.00) = Q 196.78
    assert.strictEqual(result.transactions.length, 2);
    assert.strictEqual(result.summary.validTransactionsCount, 2);
    assert.strictEqual(result.summary.totalAmount, 196.78);

    const t1 = result.transactions.find((t) => t.description.includes("INTERESES"));
    assert.ok(t1);
    assert.strictEqual(t1.date, "2026-10-12");
    assert.strictEqual(t1.amount, 111.78);
    assert.strictEqual(t1.currency, "GTQ");

    const t2 = result.transactions.find((t) => t.description.includes("CARGO POR GESTION"));
    assert.ok(t2);
    assert.strictEqual(t2.date, "2026-10-05");
    assert.strictEqual(t2.amount, 85.0);
    assert.strictEqual(t2.currency, "GTQ");

    // Payment must be skipped and logged in debugLogs
    const paymentLog = result.debugLogs.find((l) => l.description.includes("GRACIAS POR SU PAGO"));
    assert.ok(paymentLog);
    assert.strictEqual(paymentLog.amount, "500.00");
  });
});

describe("US-064: Banrural Statement Parsing Fallback to Unsupported Bank Flow", () => {
  it("routes Banrural statements to isSupportedBank: false with correct bankName", () => {
    const rawBanruralSample = "ESTADO DE CUENTA BANRURAL QUETZALES\nCuenta Monetaria 01-001\nSaldo: 100.00";
    const res = detectBankFromText(rawBanruralSample);
    assert.strictEqual(res.isBanrural, true);
    assert.strictEqual(res.isSupported, false);
    assert.strictEqual(res.bankName, "Banrural");
  });
});
