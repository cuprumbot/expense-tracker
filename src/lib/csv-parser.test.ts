import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCSVContent, detectColumnMapping } from "./csv-parser";

const STANDARD_CSV = `Fecha,Descripcion,Monto
2026-03-01,SUPERMERCADOS LA TORRE,485.50
2026-03-02,GASOLINERA SHELL,320.00
2026-03-03,NETFLIX GUATEMALA,Q 85.00
,,
`;

const AMBIGUOUS_CSV = `Dia Registro,Fecha Liquidacion,Texto Movimiento,Referencia,Cargo Q,Saldo
2026-03-01,2026-03-02,SUPERMERCADOS LA TORRE,REF-1,485.50,10000.00
2026-03-02,2026-03-03,GASOLINERA SHELL,REF-2,320.00,9680.00
`;

describe("detectColumnMapping", () => {
  it("detects standard columns without ambiguity", () => {
    const headers = ["Fecha", "Descripcion", "Monto"];
    const result = detectColumnMapping(headers);

    assert.strictEqual(result.isAmbiguous, false);
    assert.strictEqual(result.detected.dateColumn, "Fecha");
    assert.strictEqual(result.detected.descriptionColumn, "Descripcion");
    assert.strictEqual(result.detected.amountColumn, "Monto");
  });

  it("detects ambiguity when multiple candidate date or amount columns exist", () => {
    const headers = ["Dia Registro", "Fecha Liquidacion", "Texto Movimiento", "Cargo Q", "Saldo"];
    const result = detectColumnMapping(headers);

    assert.strictEqual(result.isAmbiguous, true);
    assert.ok(result.ambiguityReason && result.ambiguityReason.length > 0);
  });
});

describe("parseCSVContent", () => {
  it("automatically parses standard CSV without requiring manual mapping", () => {
    const result = parseCSVContent(STANDARD_CSV);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.needsMapping, false);
    assert.strictEqual(result.transactions.length, 3);

    const first = result.transactions[0];
    assert.strictEqual(first.date, "2026-03-01");
    assert.strictEqual(first.description, "SUPERMERCADOS LA TORRE");
    assert.strictEqual(first.amount, 485.5);
    assert.strictEqual(first.currency, "GTQ");

    // Check third transaction handled Q symbol
    const third = result.transactions[2];
    assert.strictEqual(third.amount, 85);
  });

  it("identifies ambiguous CSV and returns raw rows for mapping modal", () => {
    const result = parseCSVContent(AMBIGUOUS_CSV);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.needsMapping, true);
    assert.strictEqual(result.transactions.length, 0);
    assert.strictEqual(result.headers.length, 6);
    assert.strictEqual(result.rawRows.length, 2);
  });

  it("successfully parses ambiguous CSV when forced mapping is provided", () => {
    const result = parseCSVContent(AMBIGUOUS_CSV, {
      dateColumn: "Dia Registro",
      descriptionColumn: "Texto Movimiento",
      amountColumn: "Cargo Q",
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.needsMapping, false);
    assert.strictEqual(result.transactions.length, 2);

    assert.strictEqual(result.transactions[0].description, "SUPERMERCADOS LA TORRE");
    assert.strictEqual(result.transactions[0].amount, 485.5);
    assert.strictEqual(result.transactions[1].description, "GASOLINERA SHELL");
    assert.strictEqual(result.transactions[1].amount, 320);
  });

  it("handles empty CSV text gracefully", () => {
    const result = parseCSVContent("");
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.transactions.length, 0);
  });
});
