import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  normalizeDescription,
  normalizeDate,
  normalizeAmount,
  getTransactionSignature,
  deduplicateTransactions,
} from "./deduplication";
import { parseCSVContent } from "./csv-parser";
import { Transaction } from "@/types/transaction";

describe("US-028: Normalization & Signature Generation", () => {
  it("normalizes descriptions by lowercasing, stripping accents, and removing punctuation", () => {
    assert.strictEqual(
      normalizeDescription("SUPERMERCADOS LA TORRE, S.A."),
      "supermercados la torre sa"
    );
    assert.strictEqual(
      normalizeDescription("  Gasolinera Shell - Las Américas!! "),
      "gasolinera shell las americas"
    );
    assert.strictEqual(
      normalizeDescription("CAFÉ BARISTA / ZONA 10"),
      "cafe barista zona 10"
    );
  });

  it("normalizes dates to YYYY-MM-DD", () => {
    assert.strictEqual(normalizeDate("2026-03-01"), "2026-03-01");
    assert.strictEqual(normalizeDate("2026-03-01T00:00:00.000Z"), "2026-03-01");
  });

  it("normalizes amounts to 2 decimal places and absolute value", () => {
    assert.strictEqual(normalizeAmount(485.5), 485.5);
    assert.strictEqual(normalizeAmount(-485.501), 485.5);
    assert.strictEqual(normalizeAmount(0), 0);
  });

  it("produces identical signatures for identical normalized data", () => {
    const tx1 = {
      date: "2026-03-01",
      description: "SUPERMERCADOS LA TORRE, S.A.",
      amount: 485.5,
    };
    const tx2 = {
      date: "2026-03-01",
      description: "supermercados la torre sa",
      amount: 485.5,
    };
    assert.strictEqual(
      getTransactionSignature(tx1),
      getTransactionSignature(tx2)
    );
  });
});

describe("US-028: Duplicate Transaction Detection & Discarding", () => {
  const baseTransactions: Transaction[] = [
    {
      id: "tx-1",
      date: "2026-03-01",
      description: "SUPERMERCADOS LA TORRE ZONA 10",
      amount: 485.5,
      currency: "GTQ",
    },
    {
      id: "tx-2",
      date: "2026-03-04",
      description: "GASOLINERA SHELL LAS AMERICAS",
      amount: 320.0,
      currency: "GTQ",
    },
  ];

  it("preserves valid partial matches (only shares date, amount, or description, but not all three)", () => {
    const partialMatches: Transaction[] = [
      // Partial Match 1: Same date and amount, DIFFERENT description
      {
        id: "tx-p1",
        date: "2026-03-01",
        description: "PAIZ CARRETERA A EL SALVADOR",
        amount: 485.5,
        currency: "GTQ",
      },
      // Partial Match 2: Same description and amount, DIFFERENT date
      {
        id: "tx-p2",
        date: "2026-03-15",
        description: "SUPERMERCADOS LA TORRE ZONA 10",
        amount: 485.5,
        currency: "GTQ",
      },
      // Partial Match 3: Same date and description, DIFFERENT amount
      {
        id: "tx-p3",
        date: "2026-03-01",
        description: "SUPERMERCADOS LA TORRE ZONA 10",
        amount: 120.0,
        currency: "GTQ",
      },
    ];

    const result = deduplicateTransactions(partialMatches, baseTransactions);
    assert.strictEqual(result.discardedCount, 0);
    assert.strictEqual(result.uniqueTransactions.length, 3);
    assert.strictEqual(result.isAllDuplicates, false);
    assert.strictEqual(result.notificationMessage, null);
  });

  it("detects and discards duplicates within a single incoming batch", () => {
    const batchWithDuplicates: Transaction[] = [
      {
        id: "b-1",
        date: "2026-03-01",
        description: "RESTAURANTE SAN MARTIN",
        amount: 175.0,
        currency: "GTQ",
      },
      {
        id: "b-2",
        date: "2026-03-01",
        description: "Restaurante San Martin", // duplicate
        amount: 175.0,
        currency: "GTQ",
      },
      {
        id: "b-3",
        date: "2026-03-05",
        description: "FARMACIA GALENO",
        amount: 50.0,
        currency: "GTQ",
      },
    ];

    const result = deduplicateTransactions(batchWithDuplicates, []);
    assert.strictEqual(result.discardedCount, 1);
    assert.strictEqual(result.uniqueTransactions.length, 2);
    assert.strictEqual(
      result.notificationMessage,
      "Se detectaron y descartaron 1 transacción repetida. Es posible que hayas subido un estado de cuenta duplicado."
    );
  });

  it("detects and discards duplicates when appending against existing session transactions", () => {
    const incoming: Transaction[] = [
      // Exact duplicate of baseTransactions[0]
      {
        id: "inc-1",
        date: "2026-03-01",
        description: "supermercados la torre zona 10",
        amount: 485.5,
        currency: "GTQ",
      },
      // New unique transaction
      {
        id: "inc-2",
        date: "2026-03-08",
        description: "CEMACO ZONA 10",
        amount: 210.0,
        currency: "GTQ",
      },
    ];

    const result = deduplicateTransactions(
      incoming,
      baseTransactions,
      "segundo_archivo.csv"
    );
    assert.strictEqual(result.discardedCount, 1);
    assert.strictEqual(result.uniqueTransactions.length, 1);
    assert.strictEqual(result.uniqueTransactions[0].description, "CEMACO ZONA 10");
    assert.strictEqual(result.isAllDuplicates, false);
  });

  it("notifies clearly when 100% of transactions in an uploaded file are duplicates", () => {
    const allDuplicates: Transaction[] = [
      {
        id: "dup-1",
        date: "2026-03-01",
        description: "SUPERMERCADOS LA TORRE ZONA 10",
        amount: 485.5,
        currency: "GTQ",
      },
      {
        id: "dup-2",
        date: "2026-03-04",
        description: "GASOLINERA SHELL LAS AMERICAS",
        amount: 320.0,
        currency: "GTQ",
      },
    ];

    const result = deduplicateTransactions(
      allDuplicates,
      baseTransactions,
      "estado_cuenta_copia.pdf"
    );
    assert.strictEqual(result.discardedCount, 2);
    assert.strictEqual(result.uniqueTransactions.length, 0);
    assert.strictEqual(result.isAllDuplicates, true);
    assert.strictEqual(
      result.notificationMessage,
      "Todas las transacciones del archivo 'estado_cuenta_copia.pdf' ya se encontraban registradas y fueron omitidas."
    );
  });

  it("correctly parses and deduplicates demo/gastos_con_duplicados.csv", () => {
    const fileContent = fs.readFileSync("demo/gastos_con_duplicados.csv", "utf-8");
    const parsed = parseCSVContent(fileContent);
    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.transactions.length, 12);

    const result = deduplicateTransactions(
      parsed.transactions,
      [],
      "gastos_con_duplicados.csv"
    );
    // 12 total, 4 duplicates discarded, 8 unique valid transactions kept
    assert.strictEqual(result.discardedCount, 4);
    assert.strictEqual(result.uniqueTransactions.length, 8);
    assert.strictEqual(result.isAllDuplicates, false);
    assert.strictEqual(
      result.notificationMessage,
      "Se detectaron y descartaron 4 transacciones repetidas. Es posible que hayas subido un estado de cuenta duplicado."
    );

    // Verify all 3 partial matches are present in uniqueTransactions
    const partial1 = result.uniqueTransactions.find(
      (t) => t.description === "PAIZ CARRETERA A EL SALVADOR"
    );
    const partial2 = result.uniqueTransactions.find(
      (t) => t.date === "2026-03-15" && t.amount === 485.5
    );
    const partial3 = result.uniqueTransactions.find(
      (t) => t.date === "2026-03-01" && t.amount === 120.0
    );

    assert.ok(partial1, "Partial match 1 (different description) was kept");
    assert.ok(partial2, "Partial match 2 (different date) was kept");
    assert.ok(partial3, "Partial match 3 (different amount) was kept");
  });

  it("correctly handles sequential upload of demo/gastos_100_duplicados.csv", () => {
    const initialContent = fs.readFileSync("demo/gastos_con_duplicados.csv", "utf-8");
    const initialParsed = parseCSVContent(initialContent);
    const initialResult = deduplicateTransactions(initialParsed.transactions, []);

    const dupFileContent = fs.readFileSync("demo/gastos_100_duplicados.csv", "utf-8");
    const dupParsed = parseCSVContent(dupFileContent);

    const secondResult = deduplicateTransactions(
      dupParsed.transactions,
      initialResult.uniqueTransactions,
      "gastos_100_duplicados.csv"
    );

    assert.strictEqual(secondResult.isAllDuplicates, true);
    assert.strictEqual(secondResult.uniqueTransactions.length, 0);
    assert.strictEqual(secondResult.discardedCount, 3);
    assert.strictEqual(
      secondResult.notificationMessage,
      "Todas las transacciones del archivo 'gastos_100_duplicados.csv' ya se encontraban registradas y fueron omitidas."
    );
  });
});
