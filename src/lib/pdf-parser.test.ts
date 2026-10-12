import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  detectBankFromText,
  parseGyTStatementText,
  parsePDFStatement,
} from "./pdf-parser";

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

describe("detectBankFromText", () => {
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

describe("parseGyTStatementText", () => {
  it("extracts valid merchant expenses and filters out payments, credits and dollar charges", () => {
    const result = parseGyTStatementText(SAMPLE_GYT_TEXT);

    // Only POLLO CAMPERO, Tigo Guatemala, and BURGER KING in Q should be extracted
    assert.strictEqual(result.transactions.length, 3);
    assert.strictEqual(result.summary.validTransactionsCount, 3);

    const campero = result.transactions[0];
    assert.strictEqual(campero.date, "2026-09-02");
    assert.strictEqual(campero.description, "POLLO CAMPERO 112 AV P");
    assert.strictEqual(campero.amount, 116.8);
    assert.strictEqual(campero.currency, "GTQ");

    const tigo = result.transactions[1];
    assert.strictEqual(tigo.date, "2026-09-03");
    assert.strictEqual(tigo.description, "Tigo Guatemala");
    assert.strictEqual(tigo.amount, 215.0);

    const bk = result.transactions[2];
    assert.strictEqual(bk.date, "2026-09-04");
    assert.strictEqual(bk.description, "BURGER KING R1 ZONA 9");
    assert.strictEqual(bk.amount, 34.0);

    // Total should be 116.8 + 215 + 34 = 365.8 (excluding Netflix and Spotify in $)
    assert.strictEqual(result.summary.totalAmount, 365.8);
  });
});

describe("parsePDFStatement integration with demo files", () => {
  it("successfully parses demo1.pdf with exact Débito/Compras sum and ignores $ and Créditos", async () => {
    if (!fs.existsSync("./demo/demo1.pdf")) {
      return;
    }
    const buf = fs.readFileSync("./demo/demo1.pdf");
    const result = await parsePDFStatement(new Uint8Array(buf));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "Banco G&T Continental");
    assert.strictEqual(result.transactions.length, 69);
    assert.strictEqual(result.summary.validTransactionsCount, 69);
    assert.strictEqual(result.summary.totalAmount, 18088.13);
    assert.strictEqual(result.summary.skippedRowsCount, 22);

    // Ensure none of the extracted transactions are dollar charges or payments
    for (const tx of result.transactions) {
      assert.strictEqual(tx.currency, "GTQ");
      assert.ok(!tx.description.toLowerCase().includes("pago por internet"));
      assert.ok(!tx.description.toLowerCase().includes("cash back"));
    }
  });

  it("successfully parses demo2.pdf with exact Débito/Compras sum and ignores $ and Créditos", async () => {
    if (!fs.existsSync("./demo/demo2.pdf")) {
      return;
    }
    const buf = fs.readFileSync("./demo/demo2.pdf");
    const result = await parsePDFStatement(new Uint8Array(buf));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isSupportedBank, true);
    assert.strictEqual(result.bankName, "Banco G&T Continental");
    assert.strictEqual(result.transactions.length, 51);
    assert.strictEqual(result.summary.validTransactionsCount, 51);
    assert.strictEqual(result.summary.totalAmount, 14799.77);
    assert.strictEqual(result.summary.skippedRowsCount, 27);

    for (const tx of result.transactions) {
      assert.strictEqual(tx.currency, "GTQ");
      assert.ok(!tx.description.toLowerCase().includes("pago por internet"));
      assert.ok(!tx.description.toLowerCase().includes("cash back"));
    }
  });
});
