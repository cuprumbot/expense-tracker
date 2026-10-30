import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectBankFromText,
} from "./pdf-parser";
import {
  cleanBiDescription,
  extractStatementPeriod,
  isNonExpenseBiLine,
} from "./bi-parser";

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
    assert.strictEqual(rBam.isSupported, false);
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

  it("identifies non-expense card payments, refunds, and summary lines", () => {
    assert.strictEqual(isNonExpenseBiLine("PAGO DE TARJETA"), true);
    assert.strictEqual(isNonExpenseBiLine("PAGO POR INTERNET"), true);
    assert.strictEqual(isNonExpenseBiLine("PAGO CONTADO"), true);
    assert.strictEqual(isNonExpenseBiLine("CREDITO CASH BACK"), true);
    assert.strictEqual(isNonExpenseBiLine("SALDO ANTERIOR"), true);
    assert.strictEqual(isNonExpenseBiLine("PAGO MINIMO"), true);
    assert.strictEqual(isNonExpenseBiLine("SUPERMERCADO LA TORRE"), false);
    assert.strictEqual(isNonExpenseBiLine("RESTAURANTE SAN MARTIN"), false);
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
