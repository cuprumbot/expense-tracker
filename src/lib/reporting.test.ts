import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateReportingMetrics,
  filterTransactions,
} from "./reporting";
import { Transaction } from "@/types/transaction";

describe("US-012 & US-013: Reporting & Visualizations Unit Tests", () => {
  const sampleTransactions: Transaction[] = [
    {
      id: "tx-1",
      date: "2026-10-01",
      description: "Supermercado La Torre Zona 14",
      amount: 400.0,
      category: "Supermercado",
      currency: "GTQ",
    },
    {
      id: "tx-2",
      date: "2026-10-05",
      description: "Restaurante San Martín",
      amount: 150.0,
      category: "Restaurantes y Cafés",
      currency: "GTQ",
    },
    {
      id: "tx-3",
      date: "2026-10-10",
      description: "Netflix Mensual",
      amount: 100.0,
      category: "Suscripciones",
      isSubscription: true,
      currency: "GTQ",
    },
    {
      id: "tx-4",
      date: "2026-10-12",
      description: "Spotify Premium",
      amount: 50.0,
      category: "Suscripciones",
      isSubscription: true,
      currency: "GTQ",
    },
  ];

  it("calculates accurate total spend and category percentages when all are classified", () => {
    const metrics = calculateReportingMetrics(sampleTransactions);

    assert.equal(metrics.totalSpend, 700.0);
    assert.equal(metrics.totalTransactionsCount, 4);
    assert.equal(metrics.classifiedCount, 4);
    assert.equal(metrics.pendingCount, 0);
    assert.equal(metrics.isFullyClassified, true);

    // Top category should be Supermercado (400 / 700 = 57.1%)
    assert.ok(metrics.topCategory);
    assert.equal(metrics.topCategory.category, "Supermercado");
    assert.equal(metrics.topCategory.total, 400.0);
    assert.equal(metrics.topCategory.percentage, 57.1);
    assert.equal(metrics.topCategory.isTopCategory, true);

    // Suscripciones should be 150.0 (21.4%)
    const subCat = metrics.categories.find((c) => c.category === "Suscripciones");
    assert.ok(subCat);
    assert.equal(subCat.total, 150.0);
    assert.equal(subCat.count, 2);
    assert.equal(subCat.percentage, 21.4);
  });

  it("identifies unclassified status correctly when pending expenses exist", () => {
    const withPending: Transaction[] = [
      ...sampleTransactions,
      {
        id: "tx-5",
        date: "2026-10-15",
        description: "Pago desconocido",
        amount: 300.0,
        category: "Pendiente",
        currency: "GTQ",
      },
    ];

    const metrics = calculateReportingMetrics(withPending);
    assert.equal(metrics.totalSpend, 1000.0);
    assert.equal(metrics.classifiedCount, 4);
    assert.equal(metrics.pendingCount, 1);
    assert.equal(metrics.isFullyClassified, false);

    // Pendiente is listed in categories at the end
    const pendingCat = metrics.categories.find((c) => c.category === "Pendiente");
    assert.ok(pendingCat);
    assert.equal(pendingCat.total, 300.0);
    assert.equal(pendingCat.percentage, 30.0);
  });

  it("filters transactions by search term case-insensitively", () => {
    const results = filterTransactions(sampleTransactions, {
      searchTerm: "netflix",
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, "tx-3");
  });

  it("filters transactions by category and search term concurrently", () => {
    const results = filterTransactions(sampleTransactions, {
      category: "Suscripciones",
      searchTerm: "spot",
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, "tx-4");

    const noResults = filterTransactions(sampleTransactions, {
      category: "Supermercado",
      searchTerm: "spotify",
    });
    assert.equal(noResults.length, 0);
  });

  it("returns all transactions when filters are unset or default", () => {
    const results = filterTransactions(sampleTransactions, {
      category: "all",
      searchTerm: "",
    });
    assert.equal(results.length, 4);
  });

  it("filters transactions by currency accurately (all, GTQ, USD)", () => {
    const mixedTransactions: Transaction[] = [
      {
        id: "tx-gtq-1",
        date: "2026-10-01",
        description: "Supermercado La Torre",
        amount: 400.0,
        currency: "GTQ",
        originalCurrency: "GTQ",
      },
      {
        id: "tx-gtq-default",
        date: "2026-10-02",
        description: "Gasolinera Shell",
        amount: 250.0,
        currency: "GTQ",
      },
      {
        id: "tx-usd-1",
        date: "2026-10-03",
        description: "Netflix Subscription",
        amount: 54.87,
        currency: "GTQ",
        originalCurrency: "USD",
        originalAmount: 6.99,
        exchangeRateApplied: 7.85,
      },
      {
        id: "tx-usd-2",
        date: "2026-10-04",
        description: "Spotify Premium",
        amount: 62.72,
        currency: "GTQ",
        originalCurrency: "USD",
        originalAmount: 7.99,
        exchangeRateApplied: 7.85,
      },
    ];

    // Filter "all"
    const allResults = filterTransactions(mixedTransactions, { currency: "all" });
    assert.equal(allResults.length, 4);

    // Filter "Solo Quetzales (GTQ)"
    const gtqResults = filterTransactions(mixedTransactions, { currency: "GTQ" });
    assert.equal(gtqResults.length, 2);
    assert.deepEqual(
      gtqResults.map((t) => t.id),
      ["tx-gtq-1", "tx-gtq-default"]
    );

    // Filter "Solo Dólares (USD)"
    const usdResults = filterTransactions(mixedTransactions, { currency: "USD" });
    assert.equal(usdResults.length, 2);
    assert.deepEqual(
      usdResults.map((t) => t.id),
      ["tx-usd-1", "tx-usd-2"]
    );
  });
});
