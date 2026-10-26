import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  detectBankFromText,
  parsePDFStatement,
} from "./pdf-parser";
import {
  parseGyTStatementText,
  parseGyTStatementFromBuffer,
  cleanGyTDescription,
  isNonExpenseGyTLine,
  normalizeStatementDate,
} from "./gyt-parser";

const SAMPLE_GYT_TEXT = `
Banco G&T Continental, S.A.
www.gtc.com.gt
Página 1 de 2

5183-22XX-XXXX-0713 LUIS JIMENEZ
12-09-2026 	12-09-2026 	PAGO POR INTERNET 	Q 	1,195.77
15-09-2026 	16-09-2026 	CR M 20%DEV COMRAP 11A15SEP TC 	Q 	50.00
02-09-2026 	04-09-2026 	POLLO CAMPERO 112 AV P\\AVE PETAPA 31 GTM 	Q 	116.80
03-09-2026 	05-09-2026 	Tigo Guatemala\\KM. 9.5 CARRETERA A E GTM 	Q 	215.00
04-09-2026 	06-09-2026 	BURGER KING R1 ZONA 9\\6 AVENIDA 14-8 GTM 	Q 	34.00
22-09-2026 	22-09-2026 	1- CREDITO CASH BACK 	Q 	32.28
09-09-2026 	09-09-2026 	NETFLIX.COM\\121 Albright Way\\LOS GAT USA 	$ 	6.99
10-09-2026 	10-09-2026 	Spotify P46AF6B2C7\\Birger Jarlsgatan SWE 	$ 	7.99
Sub - total Quetzales 	Q 	18,088.13
`;

const SAMPLE_UNSUPPORTED_TEXT = `
Banco Promerica Guatemala
Estado de Cuenta Mensual
Fecha: 2026-09-15
`;

describe("US-017 & US-002: Banco G&T Continental Bank Identification", () => {
  it("identifies Banco G&T Continental from keywords", () => {
    const result = detectBankFromText(SAMPLE_GYT_TEXT);
    assert.strictEqual(result.isGyT, true);
    assert.strictEqual(result.bankName, "Banco G&T Continental");
  });

  it("identifies unsupported bank when G&T keywords are absent", () => {
    const result = detectBankFromText(SAMPLE_UNSUPPORTED_TEXT);
    assert.strictEqual(result.isGyT, false);
    assert.strictEqual(result.bankName, "Banco no identificado");
  });
});

describe("US-002: Banco G&T Continental Helpers", () => {
  it("normalizes statement dates to ISO YYYY-MM-DD", () => {
    assert.strictEqual(normalizeStatementDate("02-09-2026"), "2026-09-02");
    assert.strictEqual(normalizeStatementDate("15/10/2026"), "2026-10-15");
    assert.strictEqual(normalizeStatementDate("05-oct-2026"), "2026-10-05");
  });

  it("cleans merchant descriptions by removing location tokens and trailing country codes", () => {
    assert.strictEqual(
      cleanGyTDescription("POLLO CAMPERO 112 AV P\\AVE PETAPA 31 GTM"),
      "POLLO CAMPERO 112 AV P"
    );
    assert.strictEqual(
      cleanGyTDescription("SUPERMERCADOS LA TORRE GUA"),
      "SUPERMERCADOS LA TORRE"
    );
  });

  it("filters non-expense statement lines (payments, cashback, subtotals)", () => {
    assert.strictEqual(isNonExpenseGyTLine("PAGO POR INTERNET"), true);
    assert.strictEqual(isNonExpenseGyTLine("CREDITO CASH BACK"), true);
    assert.strictEqual(isNonExpenseGyTLine("Sub - total Quetzales"), true);
    assert.strictEqual(isNonExpenseGyTLine("POLLO CAMPERO"), false);
  });
});

describe("US-002 & US-022: parseGyTStatementText", () => {
  it("extracts valid merchant expenses in Q and $, converts $ to GTQ, and filters out payments/credits", () => {
    const result = parseGyTStatementText(SAMPLE_GYT_TEXT);

    // POLLO CAMPERO, Tigo Guatemala, BURGER KING in Q, plus NETFLIX and Spotify in $
    assert.strictEqual(result.transactions.length, 5);
    assert.strictEqual(result.summary.validTransactionsCount, 5);

    const campero = result.transactions[0];
    assert.strictEqual(campero.date, "2026-09-02");
    assert.strictEqual(campero.description, "POLLO CAMPERO 112 AV P");
    assert.strictEqual(campero.amount, 116.8);
    assert.strictEqual(campero.currency, "GTQ");
    assert.strictEqual(campero.originalCurrency, "GTQ");
    assert.strictEqual(campero.originalAmount, 116.8);

    const tigo = result.transactions[1];
    assert.strictEqual(tigo.date, "2026-09-03");
    assert.strictEqual(tigo.description, "Tigo Guatemala");
    assert.strictEqual(tigo.amount, 215.0);

    const bk = result.transactions[2];
    assert.strictEqual(bk.date, "2026-09-04");
    assert.strictEqual(bk.description, "BURGER KING R1 ZONA 9");
    assert.strictEqual(bk.amount, 34.0);

    const netflix = result.transactions[3];
    assert.strictEqual(netflix.date, "2026-09-09");
    assert.strictEqual(netflix.description, "NETFLIX.COM");
    assert.strictEqual(netflix.currency, "GTQ");
    assert.strictEqual(netflix.originalCurrency, "USD");
    assert.strictEqual(netflix.originalAmount, 6.99);
    assert.strictEqual(netflix.exchangeRateApplied, 7.85);
    assert.strictEqual(netflix.amount, 54.87); // 6.99 * 7.85 = 54.8715 -> 54.87

    const spotify = result.transactions[4];
    assert.strictEqual(spotify.date, "2026-09-10");
    assert.strictEqual(spotify.description, "Spotify P46AF6B2C7");
    assert.strictEqual(spotify.currency, "GTQ");
    assert.strictEqual(spotify.originalCurrency, "USD");
    assert.strictEqual(spotify.originalAmount, 7.99);
    assert.strictEqual(spotify.exchangeRateApplied, 7.85);
    assert.strictEqual(spotify.amount, 62.72); // 7.99 * 7.85 = 62.7215 -> 62.72

    // Total should be 116.8 + 215 + 34 + 54.87 + 62.72 = 483.39
    assert.strictEqual(result.summary.totalAmount, 483.39);
  });
});

describe("US-002 & US-017: parsePDFStatement integration with demo files (Banco G&T Continental)", () => {
  it("successfully parses demo1_muchos_pendientes.pdf including dollar expenses converted to GTQ", async () => {
    const filePath = fs.existsSync("./demo/demo1_muchos_pendientes.pdf")
      ? "./demo/demo1_muchos_pendientes.pdf"
      : "./demo/demo1.pdf";
    if (!fs.existsSync(filePath)) {
      return;
    }
    const buf = fs.readFileSync(filePath);
    const result = await parsePDFStatement(new Uint8Array(buf));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "Banco G&T Continental");
    assert.strictEqual(result.transactions.length, 72);
    assert.strictEqual(result.summary.validTransactionsCount, 72);
    assert.strictEqual(result.summary.totalAmount, 18284.14);

    const dollarTxs = result.transactions.filter(
      (tx) => tx.originalCurrency === "USD"
    );
    assert.strictEqual(dollarTxs.length, 3);
    for (const dTx of dollarTxs) {
      assert.strictEqual(dTx.currency, "GTQ");
      assert.strictEqual(dTx.exchangeRateApplied, 7.85);
      assert.ok(dTx.originalAmount && dTx.originalAmount > 0);
    }

    // Ensure payments and credits are filtered
    for (const tx of result.transactions) {
      assert.strictEqual(tx.currency, "GTQ");
      assert.ok(!tx.description.toLowerCase().includes("pago por internet"));
      assert.ok(!tx.description.toLowerCase().includes("pago internet"));
      assert.ok(!tx.description.toLowerCase().includes("cash back"));
    }
  });

  it("successfully parses demo2_pocos_pendientes.pdf including dollar expenses converted to GTQ", async () => {
    const filePath = fs.existsSync("./demo/demo2_pocos_pendientes.pdf")
      ? "./demo/demo2_pocos_pendientes.pdf"
      : "./demo/demo2.pdf";
    if (!fs.existsSync(filePath)) {
      return;
    }
    const buf = fs.readFileSync(filePath);
    const result = await parsePDFStatement(new Uint8Array(buf));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "Banco G&T Continental");
    assert.strictEqual(result.transactions.length, 55);
    assert.strictEqual(result.summary.validTransactionsCount, 55);
    assert.strictEqual(result.summary.totalAmount, 18349.23);

    const dollarTxs = result.transactions.filter(
      (tx) => tx.originalCurrency === "USD"
    );
    assert.strictEqual(dollarTxs.length, 4);
    for (const dTx of dollarTxs) {
      assert.strictEqual(dTx.currency, "GTQ");
      assert.strictEqual(dTx.exchangeRateApplied, 7.85);
      assert.ok(dTx.originalAmount && dTx.originalAmount > 0);
    }
  });
});
