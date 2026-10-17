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

describe("US-031: Multi-Month Category Time-Series Aggregation Engine Unit Tests", () => {
  const multiMonthTransactions: Transaction[] = [
    {
      id: "tx-may-1",
      date: "2026-05-10",
      description: "Supermercado La Torre",
      amount: 500.0,
      category: "Supermercado",
      currency: "GTQ",
    },
    {
      id: "tx-may-2",
      date: "2026-05-20",
      description: "San Martin",
      amount: 200.0,
      category: "Restaurantes y Cafés",
      currency: "GTQ",
    },
    {
      id: "tx-jun-1",
      date: "2026-06-15",
      description: "Supermercado Paiz",
      amount: 650.5,
      category: "Supermercado",
      currency: "GTQ",
    },
    {
      id: "tx-jul-1",
      date: "2026-07-02",
      description: "Supermercado Walmart",
      amount: 450.0,
      category: "Supermercado",
      currency: "GTQ",
    },
    {
      id: "tx-jul-2",
      date: "2026-07-18",
      description: "Netflix Mensual",
      amount: 100.0,
      category: "Suscripciones",
      currency: "GTQ",
    },
    {
      id: "tx-refund-1",
      date: "2026-07-20",
      description: "Crédito reembolso",
      amount: -50.0,
      category: "Supermercado",
      currency: "GTQ",
    },
  ];

  it("identifies all distinct calendar months in sorted chronological order", () => {
    const { calculateMonthlyCategoryTrends } = require("./reporting");
    const result = calculateMonthlyCategoryTrends(multiMonthTransactions);

    assert.equal(result.months.length, 3);
    assert.deepEqual(
      result.months.map((m: any) => m.monthKey),
      ["2026-05", "2026-06", "2026-07"]
    );
    assert.deepEqual(
      result.months.map((m: any) => m.monthLabel),
      ["May 2026", "Jun 2026", "Jul 2026"]
    );
    assert.equal(result.isSingleMonth, false);
  });

  it("calculates exact sums in GTQ and zero-fills categories in missing months", () => {
    const { calculateMonthlyCategoryTrends } = require("./reporting");
    const result = calculateMonthlyCategoryTrends(multiMonthTransactions);

    // Supermercado: May 500, Jun 650.5, Jul 450 (refund excluded)
    const superTrend = result.trends.find((t: any) => t.categoryName === "Supermercado");
    assert.ok(superTrend);
    assert.deepEqual(superTrend.monthlyTotals, [
      { monthKey: "2026-05", monthLabel: "May 2026", totalAmount: 500.0 },
      { monthKey: "2026-06", monthLabel: "Jun 2026", totalAmount: 650.5 },
      { monthKey: "2026-07", monthLabel: "Jul 2026", totalAmount: 450.0 },
    ]);

    // Restaurantes y Cafés: May 200, Jun 0 (zero fill), Jul 0 (zero fill)
    const restTrend = result.trends.find((t: any) => t.categoryName === "Restaurantes y Cafés");
    assert.ok(restTrend);
    assert.deepEqual(restTrend.monthlyTotals, [
      { monthKey: "2026-05", monthLabel: "May 2026", totalAmount: 200.0 },
      { monthKey: "2026-06", monthLabel: "Jun 2026", totalAmount: 0.0 },
      { monthKey: "2026-07", monthLabel: "Jul 2026", totalAmount: 0.0 },
    ]);

    // Suscripciones: May 0, Jun 0, Jul 100
    const subTrend = result.trends.find((t: any) => t.categoryName === "Suscripciones");
    assert.ok(subTrend);
    assert.deepEqual(subTrend.monthlyTotals, [
      { monthKey: "2026-05", monthLabel: "May 2026", totalAmount: 0.0 },
      { monthKey: "2026-06", monthLabel: "Jun 2026", totalAmount: 0.0 },
      { monthKey: "2026-07", monthLabel: "Jul 2026", totalAmount: 100.0 },
    ]);

    assert.equal(result.peakAmount, 650.5);
  });

  it("handles single-month uploads with isSingleMonth flag", () => {
    const { calculateMonthlyCategoryTrends } = require("./reporting");
    const singleMonthTx: Transaction[] = [
      {
        id: "tx-s-1",
        date: "2026-09-05",
        description: "Gasolina Shell",
        amount: 350.0,
        category: "Transporte y Combustible",
        currency: "GTQ",
      },
      {
        id: "tx-s-2",
        date: "2026-09-22",
        description: "Supermercado La Torre",
        amount: 720.0,
        category: "Supermercado",
        currency: "GTQ",
      },
    ];

    const result = calculateMonthlyCategoryTrends(singleMonthTx);
    assert.equal(result.months.length, 1);
    assert.equal(result.isSingleMonth, true);
    assert.equal(result.months[0].monthKey, "2026-09");
    assert.equal(result.months[0].monthLabel, "Sep 2026");
    assert.equal(result.peakAmount, 720.0);
  });

  it("resolves custom category colors accurately", () => {
    const { calculateMonthlyCategoryTrends } = require("./reporting");
    const customTx: Transaction[] = [
      {
        id: "tx-c-1",
        date: "2026-08-01",
        description: "Comida para perro",
        amount: 250.0,
        category: "Mascotas VIP",
        currency: "GTQ",
      },
    ];
    const customCats = [
      { id: "custom-1", name: "Mascotas VIP", color: "#e11d48" },
    ];

    const result = calculateMonthlyCategoryTrends(customTx, customCats);
    assert.equal(result.trends.length, 1);
    assert.equal(result.trends[0].categoryName, "Mascotas VIP");
    assert.equal(result.trends[0].color, "#e11d48");
  });
});

describe("US-033: Vendor Aggregation Engine Unit Tests", () => {
  const { normalizeMerchantName, calculateTopVendors } = require("./reporting");

  it("normalizes vendor descriptions by stripping POS prefixes, terminal IDs and branch tokens", () => {
    assert.equal(
      normalizeMerchantName("POS COMPRA EN SUPERMERCADO LA TORRE ZONA 14 GTM"),
      "Supermercados La Torre"
    );
    assert.equal(
      normalizeMerchantName("ESTBL SAN MARTIN Z.10 LOCAL 102"),
      "San Martín"
    );
    assert.equal(
      normalizeMerchantName("COMPRA EN POLLO CAMPERO TERM 5912"),
      "Pollo Campero"
    );
    assert.equal(
      normalizeMerchantName("UBER *TRIP HELP.UBER.COM"),
      "Uber"
    );
  });

  it("calculates top vendors by spend volume and by transaction frequency accurately", () => {
    const transactions: Transaction[] = [
      // La Torre: 2 purchases, total 1000 GTQ
      {
        id: "tx-v-1",
        date: "2026-07-01",
        description: "POS La Torre Zona 14",
        amount: 600.0,
        category: "Supermercado",
        currency: "GTQ",
      },
      {
        id: "tx-v-2",
        date: "2026-07-05",
        description: "Supermercado La Torre",
        amount: 400.0,
        category: "Supermercado",
        currency: "GTQ",
      },
      // San Martín: 3 purchases, total 300 GTQ
      {
        id: "tx-v-3",
        date: "2026-07-02",
        description: "San Martin Z.10",
        amount: 100.0,
        category: "Restaurantes y Cafés",
        currency: "GTQ",
      },
      {
        id: "tx-v-4",
        date: "2026-07-08",
        description: "San Martin Cafe",
        amount: 100.0,
        category: "Restaurantes y Cafés",
        currency: "GTQ",
      },
      {
        id: "tx-v-5",
        date: "2026-07-15",
        description: "Panaderia San Martin",
        amount: 100.0,
        category: "Restaurantes y Cafés",
        currency: "GTQ",
      },
      // Gasolina Shell: 1 purchase, total 500 GTQ
      {
        id: "tx-v-6",
        date: "2026-07-04",
        description: "Estacion Shell Los Proceres",
        amount: 500.0,
        category: "Transporte y Combustible",
        currency: "GTQ",
      },
    ];

    const result = calculateTopVendors(transactions, 3);

    // Total spend: 1000 + 300 + 500 = 1800 GTQ, 6 transactions
    assert.equal(result.totalSpendGTQ, 1800.0);
    assert.equal(result.totalTransactionsCount, 6);

    // By Amount:
    // 1. Supermercados La Torre: 1000.0 (55.6%)
    // 2. Shell: 500.0 (27.8%)
    // 3. San Martín: 300.0 (16.7%)
    assert.equal(result.byAmount[0].merchantName, "Supermercados La Torre");
    assert.equal(result.byAmount[0].totalAmountGTQ, 1000.0);
    assert.equal(result.byAmount[0].transactionCount, 2);
    assert.equal(result.byAmount[0].percentageShare, 55.6);
    assert.equal(result.byAmount[0].averageTicketGTQ, 500.0);

    assert.equal(result.byAmount[1].merchantName, "Shell");
    assert.equal(result.byAmount[1].totalAmountGTQ, 500.0);

    assert.equal(result.byAmount[2].merchantName, "San Martín");
    assert.equal(result.byAmount[2].totalAmountGTQ, 300.0);

    // By Frequency:
    // 1. San Martín: 3 purchases (average ticket 100.0)
    // 2. Supermercados La Torre: 2 purchases (average ticket 500.0)
    // 3. Shell: 1 purchase (average ticket 500.0)
    assert.equal(result.byFrequency[0].merchantName, "San Martín");
    assert.equal(result.byFrequency[0].transactionCount, 3);
    assert.equal(result.byFrequency[0].averageTicketGTQ, 100.0);

    assert.equal(result.byFrequency[1].merchantName, "Supermercados La Torre");
    assert.equal(result.byFrequency[1].transactionCount, 2);

    assert.equal(result.byFrequency[2].merchantName, "Shell");
    assert.equal(result.byFrequency[2].transactionCount, 1);
  });
});

describe("US-035: Day-of-Week & Day-of-Month Temporal Aggregation & Anomaly Heuristics Unit Tests", () => {
  const { calculateConsumptionPatterns } = require("./reporting");

  // 2026-10-12 is Monday, 2026-10-13 is Tuesday, 2026-10-14 is Wednesday,
  // 2026-10-15 is Thursday, 2026-10-16 is Friday, 2026-10-17 is Saturday, 2026-10-18 is Sunday.
  const patternTransactions: Transaction[] = [
    { id: "p1", date: "2026-10-12", description: "Café", amount: 50.0, category: "Restaurantes", currency: "GTQ" }, // Lunes
    { id: "p2", date: "2026-10-13", description: "Almuerzo", amount: 60.0, category: "Restaurantes", currency: "GTQ" }, // Martes
    { id: "p3", date: "2026-10-14", description: "Gasolina", amount: 70.0, category: "Transporte", currency: "GTQ" }, // Miércoles
    { id: "p4", date: "2026-10-15", description: "Farmacia", amount: 40.0, category: "Salud", currency: "GTQ" }, // Jueves
    // Massive outlier spike on Friday:
    { id: "p5", date: "2026-10-16", description: "Compra extraordinaria", amount: 3500.0, category: "Tecnología", currency: "GTQ" }, // Viernes
    { id: "p6", date: "2026-10-17", description: "Supermercado", amount: 200.0, category: "Supermercado", currency: "GTQ" }, // Sábado
    { id: "p7", date: "2026-10-18", description: "Cine", amount: 80.0, category: "Entretenimiento", currency: "GTQ" }, // Domingo
  ];

  it("aggregates spending across all 7 days of the week starting with Lunes", () => {
    const result = calculateConsumptionPatterns(patternTransactions);

    assert.equal(result.dayOfWeek.items.length, 7);
    assert.deepEqual(
      result.dayOfWeek.items.map((i: any) => i.shortLabel),
      ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    );

    const monday = result.dayOfWeek.items[0];
    assert.equal(monday.label, "Lunes");
    assert.equal(monday.totalAmountGTQ, 50.0);

    const friday = result.dayOfWeek.items[4];
    assert.equal(friday.label, "Viernes");
    assert.equal(friday.totalAmountGTQ, 3500.0);
  });

  it("calculates mean, standard deviation, and flags Friday as a statistical outlier", () => {
    const result = calculateConsumptionPatterns(patternTransactions);

    // Friday with 3500 heavily exceeds mean + 1.75 * stdDev
    const friday = result.dayOfWeek.items[4];
    assert.equal(friday.isOutlier, true);
    assert.ok(friday.anomalyScore && friday.anomalyScore > 1.75);

    // Other days are not outliers
    const monday = result.dayOfWeek.items[0];
    assert.equal(monday.isOutlier, false);

    // Insights generate Spanish anomaly description
    const dowInsight = result.insights.find((ins: any) => ins.type === "day_of_week");
    assert.ok(dowInsight);
    assert.equal(dowInsight.isAnomaly, true);
    assert.match(dowInsight.description, /viernes/i);
  });

  it("aggregates across 31 days of the month and detects day 16 spike", () => {
    const result = calculateConsumptionPatterns(patternTransactions);

    assert.equal(result.dayOfMonth.items.length, 31);
    const day16 = result.dayOfMonth.items[15]; // index 15 = Day 16
    assert.equal(day16.shortLabel, "16");
    assert.equal(day16.totalAmountGTQ, 3500.0);
    assert.equal(day16.isOutlier, true);

    const domInsight = result.insights.find((ins: any) => ins.type === "day_of_month");
    assert.ok(domInsight);
    assert.equal(domInsight.isAnomaly, true);
  });
});



