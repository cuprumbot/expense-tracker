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
  parseBiStatementText,
} from "./bi-parser";

const SAMPLE_BI_MONETARIO_TEXT = `
Banco Industrial, S.A.
Cuenta Estandarizada GT75 INDL 0101 0000 0006 9579 8863
LUDWING GOMEZ MAYO/25
9 AVE 2-60 ZONA 13 RIVERA DEL RIO
Día Doc. Descripción Débito Crédito Saldo
****SALDO ANTERIOR**** 5,000.00
02 112233 NOTA DEBITO SUPERMERCADO LA TORRE 450.50 4,549.50
05 445566 NOTA CREDITO DEPOSITO NOMINA 10,000.00 14,549.50
10 778899 NOTA DEBITO ATM 045 AGENCIA ROOSEVELT 200.00 14,349.50
15 990011 RESTAURANTE SAN MARTIN\\CALZ ROOSEVELT GTM 185.00 14,164.50
20 223344 PAGO ELECTRONICO TARJETA CREDITO 1,500.00 12,664.50
28 334455 POLLO CAMPERO ROOSEVELT GUA 120.00 12,544.50
Sub - total Quetzales 2,455.50
`;

const SAMPLE_BI_MULTIPAGE_MONETARIO_TEXT = `
Banco Industrial, S.A.
Cuenta Estandarizada GT75 INDL 0101 0000 0006 9579 8863
ABRIL/25
Pag 1/2
Día Doc. Descripción Débito Crédito Saldo
****SALDO ANTERIOR**** 1,000.00
01 101 ahorro casita 200.00 800.00
02 102 NOTA DEBITO SERBIPAGO 50.00 750.00
Pag 2/2
03 103 NOTA CREDITO REEMBOLSO 300.00 1,050.00
04 104 FARMACIA GALENO 150.00 900.00
`;

describe("US-017 & US-018: Multi-Bank Identification Engine", () => {
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

  it("identifies Banrural and BAM as known banks (preparing for US-019 & US-020)", () => {
    const rBanrural = detectBankFromText("Estado de cuenta Banrural www.banrural.com.gt");
    assert.strictEqual(rBanrural.bankName, "Banrural");
    assert.strictEqual(rBanrural.isBanrural, true);
    assert.strictEqual(rBanrural.isSupported, false);

    const rBam = detectBankFromText("Banco Agromercantil BAM de Guatemala");
    assert.strictEqual(rBam.bankName, "Banco Agromercantil (BAM)");
    assert.strictEqual(rBam.isBAM, true);
    assert.strictEqual(rBam.isSupported, false);
  });

  it("correctly flags unsupported banks", () => {
    const res = detectBankFromText("Banco Cuscatlan de El Salvador");
    assert.strictEqual(res.bankName, "Banco no identificado");
    assert.strictEqual(res.isSupported, false);
  });
});

describe("US-018: Banco Industrial Description Cleaning & Period Parsing", () => {
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
  });
});

describe("US-018: Banco Industrial Plain-Text Statement Parsing (Simulated Fixtures)", () => {
  it("parses single-page Monetaria statement fixture and distinguishes debits from credits", () => {
    const result = parseBiStatementText(SAMPLE_BI_MONETARIO_TEXT);

    // Expected valid expenses:
    // 1) 02-05: SUPERMERCADO LA TORRE (450.50)
    // 2) 10-05: ATM 045 AGENCIA ROOSEVELT (200.00)
    // 3) 15-05: RESTAURANTE SAN MARTIN (185.00)
    // 4) 28-05: POLLO CAMPERO ROOSEVELT (120.00)
    // Filtered: NOTA CREDITO DEPOSITO NOMINA (credit), PAGO ELECTRONICO TARJETA CREDITO (payment)
    assert.strictEqual(result.transactions.length, 4);
    assert.strictEqual(result.summary.validTransactionsCount, 4);

    const t1 = result.transactions[0];
    assert.strictEqual(t1.date, "2025-05-02");
    assert.strictEqual(t1.description, "SUPERMERCADO LA TORRE");
    assert.strictEqual(t1.amount, 450.5);
    assert.strictEqual(t1.currency, "GTQ");
    assert.strictEqual(t1.classificationSource, "local");

    const t2 = result.transactions[1];
    assert.strictEqual(t2.date, "2025-05-10");
    assert.strictEqual(t2.description, "ATM 045 AGENCIA ROOSEVELT");
    assert.strictEqual(t2.amount, 200.0);

    const t3 = result.transactions[2];
    assert.strictEqual(t3.date, "2025-05-15");
    assert.strictEqual(t3.description, "RESTAURANTE SAN MARTIN");
    assert.strictEqual(t3.amount, 185.0);

    const t4 = result.transactions[3];
    assert.strictEqual(t4.date, "2025-05-28");
    assert.strictEqual(t4.description, "POLLO CAMPERO ROOSEVELT");
    assert.strictEqual(t4.amount, 120.0);

    // Total: 450.50 + 200.00 + 185.00 + 120.00 = 955.50
    assert.strictEqual(result.summary.totalAmount, 955.5);
  });

  it("parses multi-page Monetaria statement fixture across page markers", () => {
    const result = parseBiStatementText(SAMPLE_BI_MULTIPAGE_MONETARIO_TEXT);

    // Debits:
    // 1) 01-04: ahorro casita (200.00)
    // 2) 02-04: SERBIPAGO (50.00)
    // 3) 04-04: FARMACIA GALENO (150.00)
    // Filtered: NOTA CREDITO REEMBOLSO (300.00)
    assert.strictEqual(result.transactions.length, 3);
    assert.strictEqual(result.summary.validTransactionsCount, 3);
    assert.strictEqual(result.summary.totalAmount, 400.0);
    assert.strictEqual(result.transactions[0].date, "2025-04-01");
    assert.strictEqual(result.transactions[1].description, "SERBIPAGO");
    assert.strictEqual(result.transactions[2].description, "FARMACIA GALENO");
  });
});

describe("US-018: Banco Industrial Real Statement Verification (demo/BI-2025-xx.pdf)", () => {
  it("successfully parses demo/BI-2025-04.pdf with exact mathematical total", async () => {
    const filePath = "./demo/BI-2025-04.pdf";
    if (!fs.existsSync(filePath)) return;

    const buf = fs.readFileSync(filePath);
    const result = await parsePDFStatement(new Uint8Array(buf));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "Banco Industrial");

    // Official statement total debits is Q 42,978.25 across 24 transactions
    assert.strictEqual(result.transactions.length, 24);
    assert.strictEqual(result.summary.validTransactionsCount, 24);
    assert.strictEqual(result.summary.totalAmount, 42978.25);

    for (const tx of result.transactions) {
      assert.strictEqual(tx.currency, "GTQ");
      assert.strictEqual(tx.classificationSource, "local");
      assert.match(tx.date, /^2025-04-\d{2}$/);
      assert.ok(tx.amount > 0);
    }
  });

  it("successfully parses demo/BI-2025-06.pdf with exact mathematical total", async () => {
    const filePath = "./demo/BI-2025-06.pdf";
    if (!fs.existsSync(filePath)) return;

    const buf = fs.readFileSync(filePath);
    const result = await parsePDFStatement(new Uint8Array(buf));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "Banco Industrial");

    // Official statement total debits is Q 20,739.50 across 20 transactions
    assert.strictEqual(result.transactions.length, 20);
    assert.strictEqual(result.summary.validTransactionsCount, 20);
    assert.strictEqual(result.summary.totalAmount, 20739.5);
  });

  it("successfully parses demo/BI-2025-07.pdf with exact mathematical total", async () => {
    const filePath = "./demo/BI-2025-07.pdf";
    if (!fs.existsSync(filePath)) return;

    const buf = fs.readFileSync(filePath);
    const result = await parsePDFStatement(new Uint8Array(buf));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "Banco Industrial");

    // Official statement total debits is Q 12,957.50 across 19 transactions
    assert.strictEqual(result.transactions.length, 19);
    assert.strictEqual(result.summary.validTransactionsCount, 19);
    assert.strictEqual(result.summary.totalAmount, 12957.5);
  });

  it("successfully parses demo/BI-2025-08.pdf with exact mathematical total", async () => {
    const filePath = "./demo/BI-2025-08.pdf";
    if (!fs.existsSync(filePath)) return;

    const buf = fs.readFileSync(filePath);
    const result = await parsePDFStatement(new Uint8Array(buf));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "Banco Industrial");

    // Official statement total debits is Q 9,306.60 across 17 transactions
    assert.strictEqual(result.transactions.length, 17);
    assert.strictEqual(result.summary.validTransactionsCount, 17);
    assert.strictEqual(result.summary.totalAmount, 9306.6);
  });
});
