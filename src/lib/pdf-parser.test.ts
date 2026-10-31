import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  detectBankFromText,
  parsePDFStatement,
  parseBiCreditCardStatement,
  parseCuscatlanCreditCardStatement,
  parseBacCreditCardStatement,
  parseFicohsaCreditCardStatement,
  parseBamCreditCardStatement,
} from "./pdf-parser";

describe("US-065: Multi-Bank Identification & Automatic Bank Selection (Unit Tests)", () => {
  describe("detectBankFromText: Banco Industrial keyword coverage", () => {
    const testCases = [
      { text: "ESTADO DE CUENTA BANCO INDUSTRIAL GUATEMALA", expected: "Banco Industrial" },
      { text: "Acceda a sus operaciones en Bi en Línea", expected: "Banco Industrial" },
      { text: "Acceda a bi en linea web", expected: "Banco Industrial" },
      { text: "Para consultas ingrese a bi.com.gt", expected: "Banco Industrial" },
      { text: "Programa de lealtad Club Bi", expected: "Banco Industrial" },
      { text: "Tarjeta Bi Credit Mastercard", expected: "Banco Industrial" },
      { text: "Corporación Bi - Servicios Financieros", expected: "Banco Industrial" },
      { text: "Corporacion Bi internacional", expected: "Banco Industrial" },
      { text: "Tarjeta de Crédito Bi Oro", expected: "Banco Industrial" },
      { text: "Tarjeta de credito bi clásica", expected: "Banco Industrial" },
      { text: "Cuotas Extraf/Cuotas cargadas a la cuenta", expected: "Banco Industrial" },
    ];

    for (const { text, expected } of testCases) {
      it(`identifies Banco Industrial from: "${text}"`, () => {
        const result = detectBankFromText(text);
        assert.equal(result.isBI, true);
        assert.equal(result.isSupported, true);
        assert.equal(result.bankName, expected);
      });
    }
  });

  describe("detectBankFromText: Banco Cuscatlán keyword coverage", () => {
    const testCases = [
      { text: "Banco Cuscatlán de Guatemala, S.A.", expected: "Banco Cuscatlán" },
      { text: "Banco Cuscatlan servicio al cliente", expected: "Banco Cuscatlán" },
      { text: "Pago de Tarjeta de Crédito Cuscatlán", expected: "Banco Cuscatlán" },
      { text: "Tarjeta de credito cuscatlan visa", expected: "Banco Cuscatlán" },
      { text: "Programa MultiPremios Cuscatlán", expected: "Banco Cuscatlán" },
      { text: "Puntos Multipremios cuscatlan acumulados", expected: "Banco Cuscatlán" },
      { text: "Consulte en bancocuscatlan.com.gt", expected: "Banco Cuscatlán" },
      { text: "Portal tarjetascuscatlan.com.gt", expected: "Banco Cuscatlán" },
    ];

    for (const { text, expected } of testCases) {
      it(`identifies Banco Cuscatlán from: "${text}"`, () => {
        const result = detectBankFromText(text);
        assert.equal(result.isCuscatlan, true);
        assert.equal(result.isSupported, true);
        assert.equal(result.bankName, expected);
      });
    }
  });

  describe("detectBankFromText: BAC Credomatic keyword coverage", () => {
    const testCases = [
      { text: "BAC Credomatic Guatemala Estado de Cuenta", expected: "BAC Credomatic" },
      { text: "Consulte en baccredomatic.com", expected: "BAC Credomatic" },
      { text: "baccredomatic.gt servicio al cliente", expected: "BAC Credomatic" },
      { text: "Visite bac.net para transacciones", expected: "BAC Credomatic" },
      { text: "Puntos BAC acumulados al corte", expected: "BAC Credomatic" },
      { text: "Pago de Tarjeta de Crédito BAC", expected: "BAC Credomatic" },
      { text: "Tarjeta de credito bac emitida", expected: "BAC Credomatic" },
      { text: "American Express BAC Blue", expected: "BAC Credomatic" },
      { text: "Mastercard BAC Black", expected: "BAC Credomatic" },
      { text: "Visa BAC Signature", expected: "BAC Credomatic" },
      { text: "Credomatic de Guatemala SA", expected: "BAC Credomatic" },
    ];

    for (const { text, expected } of testCases) {
      it(`identifies BAC Credomatic from: "${text}"`, () => {
        const result = detectBankFromText(text);
        assert.equal(result.isBac, true);
        assert.equal(result.isSupported, true);
        assert.equal(result.bankName, expected);
      });
    }
  });

  describe("detectBankFromText: Banco FICOHSA keyword coverage", () => {
    const testCases = [
      { text: "Banco Ficohsa Guatemala, S.A.", expected: "Banco FICOHSA" },
      { text: "Ficohsa Estado de Cuenta de Tarjeta", expected: "Banco FICOHSA" },
      { text: "Portal web ficohsa.com", expected: "Banco FICOHSA" },
      { text: "Atención en ficohsa.com.gt", expected: "Banco FICOHSA" },
      { text: "Tarjeta de Crédito Ficohsa Infinite", expected: "Banco FICOHSA" },
      { text: "Tarjeta de credito ficohsa visa", expected: "Banco FICOHSA" },
      { text: "Canjee sus Puntos Ficohsa en comercios", expected: "Banco FICOHSA" },
      { text: "Beneficio de Cash Back Ficohsa acreditado", expected: "Banco FICOHSA" },
    ];

    for (const { text, expected } of testCases) {
      it(`identifies Banco FICOHSA from: "${text}"`, () => {
        const result = detectBankFromText(text);
        assert.equal(result.isFicohsa, true);
        assert.equal(result.isSupported, true);
        assert.equal(result.bankName, expected);
      });
    }
  });

  describe("detectBankFromText: Banco Agromercantil (BAM) keyword coverage", () => {
    const testCases = [
      { text: "Banco Agromercantil de Guatemala S.A.", expected: "Banco Agromercantil (BAM)" },
      { text: "Portal bam.com.gt en línea", expected: "Banco Agromercantil (BAM)" },
      { text: "Tarjeta de Crédito BAM Platinum", expected: "Banco Agromercantil (BAM)" },
      { text: "Tarjeta de credito bam clásica", expected: "Banco Agromercantil (BAM)" },
      { text: "Acumulación Puntos BAM corte del mes", expected: "Banco Agromercantil (BAM)" },
      { text: "Estado de cuenta BAM internacional", expected: "Banco Agromercantil (BAM)" },
    ];

    for (const { text, expected } of testCases) {
      it(`identifies BAM from: "${text}"`, () => {
        const result = detectBankFromText(text);
        assert.equal(result.isBAM, true);
        assert.equal(result.isSupported, true);
        assert.equal(result.bankName, expected);
      });
    }
  });

  describe("detectBankFromText: Unsupported banks and generic fallback", () => {
    it("flags Banrural as an unsupported bank (deprecated scope)", () => {
      const res = detectBankFromText("Banrural Estado de Cuenta de Depósitos");
      assert.equal(res.isBanrural, true);
      assert.equal(res.isSupported, false);
      assert.equal(res.bankName, "Banrural");
    });

    it("flags unknown foreign or unsupported institutions as 'Banco no identificado'", () => {
      const res = detectBankFromText("Banco Santander Rio de la Plata Resumen Mensual");
      assert.equal(res.isSupported, false);
      assert.equal(res.bankName, "Banco no identificado");
    });

    it("handles empty or whitespace-only text gracefully", () => {
      const res = detectBankFromText("    \n\t   ");
      assert.equal(res.isSupported, false);
      assert.equal(res.bankName, "Banco no identificado");
    });
  });

  describe("parsePDFStatement: Automatic Bank Selection & End-to-End Statement Parsing", () => {
    const demoDir = path.resolve(process.cwd(), "demo");

    it("automatically identifies and parses Banco Industrial from demo/BI-max.pdf", async () => {
      const filePath = path.join(demoDir, "BI-max.pdf");
      if (!fs.existsSync(filePath)) return;

      const buffer = fs.readFileSync(filePath);
      const result = await parsePDFStatement(new Uint8Array(buffer));

      assert.equal(result.success, true);
      assert.equal(result.isSupportedBank, true);
      assert.equal(result.bankName, "Banco Industrial");
      assert.ok(result.transactions.length > 0, "Should extract BI transactions");
      for (const tx of result.transactions) {
        assert.equal(tx.classificationSource, "local");
        assert.ok(typeof tx.amount === "number" && tx.amount > 0);
        assert.ok(tx.date && /^\d{4}-\d{2}-\d{2}$/.test(tx.date));
      }
    });

    it("automatically identifies and parses Banco Cuscatlán from demo/CUSCATLAN-brolo.pdf", async () => {
      const filePath = path.join(demoDir, "CUSCATLAN-brolo.pdf");
      if (!fs.existsSync(filePath)) return;

      const buffer = fs.readFileSync(filePath);
      const result = await parsePDFStatement(new Uint8Array(buffer));

      assert.equal(result.success, true);
      assert.equal(result.isSupportedBank, true);
      assert.equal(result.bankName, "Banco Cuscatlán");
      assert.ok(result.transactions.length > 0, "Should extract Cuscatlán transactions");
      for (const tx of result.transactions) {
        assert.equal(tx.classificationSource, "local");
        assert.ok(typeof tx.amount === "number" && tx.amount > 0);
        assert.ok(tx.date && /^\d{4}-\d{2}-\d{2}$/.test(tx.date));
      }
    });

    it("automatically identifies and parses BAC Credomatic from demo/BAC-brolo.pdf", async () => {
      const filePath = path.join(demoDir, "BAC-brolo.pdf");
      if (!fs.existsSync(filePath)) return;

      const buffer = fs.readFileSync(filePath);
      const result = await parsePDFStatement(new Uint8Array(buffer));

      assert.equal(result.success, true);
      assert.equal(result.isSupportedBank, true);
      assert.equal(result.bankName, "BAC Credomatic");
      assert.ok(result.transactions.length > 0, "Should extract BAC transactions");
      for (const tx of result.transactions) {
        assert.equal(tx.classificationSource, "local");
        assert.ok(typeof tx.amount === "number" && tx.amount > 0);
        assert.ok(tx.date && /^\d{4}-\d{2}-\d{2}$/.test(tx.date));
      }
    });

    it("automatically identifies and parses Banco FICOHSA from demo/FICOHSA-brolo.pdf", async () => {
      const filePath = path.join(demoDir, "FICOHSA-brolo.pdf");
      if (!fs.existsSync(filePath)) return;

      const buffer = fs.readFileSync(filePath);
      const result = await parsePDFStatement(new Uint8Array(buffer));

      assert.equal(result.success, true);
      assert.equal(result.isSupportedBank, true);
      assert.equal(result.bankName, "Banco FICOHSA");
      assert.ok(result.transactions.length > 0, "Should extract FICOHSA transactions");
      for (const tx of result.transactions) {
        assert.equal(tx.classificationSource, "local");
        assert.ok(typeof tx.amount === "number" && tx.amount > 0);
        assert.ok(tx.date && /^\d{4}-\d{2}-\d{2}$/.test(tx.date));
      }
    });

    it("automatically identifies and parses Banco FICOHSA from demo/FICOHSA-chofo.pdf", async () => {
      const filePath = path.join(demoDir, "FICOHSA-chofo.pdf");
      if (!fs.existsSync(filePath)) return;

      const buffer = fs.readFileSync(filePath);
      const result = await parsePDFStatement(new Uint8Array(buffer));

      assert.equal(result.success, true);
      assert.equal(result.isSupportedBank, true);
      assert.equal(result.bankName, "Banco FICOHSA");
      assert.ok(result.transactions.length > 0, "Should extract FICOHSA transactions");
      for (const tx of result.transactions) {
        assert.equal(tx.classificationSource, "local");
        assert.ok(typeof tx.amount === "number" && tx.amount > 0);
        assert.ok(tx.date && /^\d{4}-\d{2}-\d{2}$/.test(tx.date));
      }
    });

    it("automatically identifies and parses Banco Agromercantil (BAM) from demo/BAM-brolo.pdf", async () => {
      const filePath = path.join(demoDir, "BAM-brolo.pdf");
      if (!fs.existsSync(filePath)) return;

      const buffer = fs.readFileSync(filePath);
      const result = await parsePDFStatement(new Uint8Array(buffer));

      assert.equal(result.success, true);
      assert.equal(result.isSupportedBank, true);
      assert.equal(result.bankName, "Banco Agromercantil (BAM)");
      assert.ok(result.transactions.length > 0, "Should extract BAM transactions via vector fallback");
      for (const tx of result.transactions) {
        assert.equal(tx.classificationSource, "local");
        assert.ok(typeof tx.amount === "number" && tx.amount > 0);
        assert.ok(tx.date && /^\d{4}-\d{2}-\d{2}$/.test(tx.date));
      }
    });

    it("returns isSupportedBank: false and empty transactions for unsupported PDF content", async () => {
      // Create minimal valid empty PDF structure
      const minimalPdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n115\n%%EOF";
      const buffer = Buffer.from(minimalPdf, "utf-8");
      const result = await parsePDFStatement(new Uint8Array(buffer));

      assert.equal(result.success, true);
      assert.equal(result.isSupportedBank, false);
      assert.equal(result.transactions.length, 0);
      assert.equal(result.summary.validTransactionsCount, 0);
    });
  });

  describe("Specialized Parser Export Aliases", () => {
    it("exports dedicated parseXCreditCardStatement functions for each bank", () => {
      assert.equal(typeof parseBiCreditCardStatement, "function");
      assert.equal(typeof parseCuscatlanCreditCardStatement, "function");
      assert.equal(typeof parseBacCreditCardStatement, "function");
      assert.equal(typeof parseFicohsaCreditCardStatement, "function");
      assert.equal(typeof parseBamCreditCardStatement, "function");
    });
  });
});

