import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isCategoryEssential,
  TIERED_AMOUNT_PRESETS,
  getCategoryHistoricalStats,
  getBudgetForMonth,
  generateRealisticBudgetFromTransactions,
  computeHistoricalMonthlyCategoryAverages,
  isFixedCommitmentCategory,
  roundToCleanQuetzales,
} from "./budget-engine";
import { Transaction } from "@/types/transaction";

describe("US-056: Budget Category Tiers & Historical Context Helpers", () => {
  it("correctly identifies essential living categories vs discretionary categories", () => {
    assert.strictEqual(isCategoryEssential("supermercado", "Supermercado"), true);
    assert.strictEqual(isCategoryEssential("servicios", "Servicios Básicos"), true);
    assert.strictEqual(isCategoryEssential("transporte", "Transporte y Combustible"), true);
    assert.strictEqual(isCategoryEssential("salud", "Salud y Farmacia"), true);
    assert.strictEqual(isCategoryEssential("educacion", "Educación y Librerías"), true);
    assert.strictEqual(isCategoryEssential("visacuotas_financiamiento", "Visacuotas y Financiamiento"), true);
    assert.strictEqual(isCategoryEssential("hogar", "Hogar y Mascotas"), true);

    // Discretionary
    assert.strictEqual(isCategoryEssential("restaurantes", "Restaurantes y Cafés"), false);
    assert.strictEqual(isCategoryEssential("entretenimiento", "Entretenimiento y Compras"), false);
    assert.strictEqual(isCategoryEssential("suscripciones", "Suscripciones"), false);
    assert.strictEqual(isCategoryEssential("tecnologia", "Tecnología y Computación"), false);
  });

  it("provides higher tiered amount suggestions for essentials than for discretionary", () => {
    assert.ok(TIERED_AMOUNT_PRESETS.essential[0] >= 1000);
    assert.ok(TIERED_AMOUNT_PRESETS.discretionary[0] <= 200);
    assert.ok(
      TIERED_AMOUNT_PRESETS.essential[TIERED_AMOUNT_PRESETS.essential.length - 1] >
        TIERED_AMOUNT_PRESETS.discretionary[TIERED_AMOUNT_PRESETS.discretionary.length - 1]
    );
  });

  it("calculates accurate historical stats when transactions exist for a category", () => {
    const mockTxs: Transaction[] = [
      {
        id: "tx-1",
        date: "2026-08-05",
        description: "Supermercado La Torre",
        amount: 800,
        currency: "GTQ",
        category: "Supermercado",
      },
      {
        id: "tx-2",
        date: "2026-08-20",
        description: "Supermercado Walmart",
        amount: 1200,
        currency: "GTQ",
        category: "Supermercado",
      },
      {
        id: "tx-3",
        date: "2026-09-10",
        description: "Supermercado Paiz",
        amount: 1500,
        currency: "GTQ",
        category: "Supermercado",
      },
    ];

    const stats = getCategoryHistoricalStats(mockTxs, "Supermercado");
    assert.ok(stats);
    // Month 2026-08 = 2000, Month 2026-09 = 1500. Average = (2000 + 1500) / 2 = 1750
    assert.strictEqual(stats.averageMonthlyGTQ, 1750);
    // Last month (2026-09) = 1500
    assert.strictEqual(stats.lastMonthGTQ, 1500);
    // Goal -10% = 1750 * 0.9 = 1575
    assert.strictEqual(stats.goalMinus10GTQ, 1575);
  });

  it("returns null when no transactions exist for the requested category", () => {
    const stats = getCategoryHistoricalStats([], "Supermercado");
    assert.strictEqual(stats, null);
  });

  describe("US-057: Realistic Budget From Transactions Generator Unit Tests", () => {
    const singleMonthTxs: Transaction[] = [
      {
        id: "tx-s-1",
        date: "2026-09-02",
        description: "Supermercado La Torre",
        amount: 2000,
        currency: "GTQ",
        category: "Supermercado",
      },
      {
        id: "tx-s-2",
        date: "2026-09-05",
        description: "Restaurante San Martin",
        amount: 600,
        currency: "GTQ",
        category: "Restaurantes y Cafés",
      },
      {
        id: "tx-s-3",
        date: "2026-09-10",
        description: "Pago EEGSA",
        amount: 400,
        currency: "GTQ",
        category: "Servicios Básicos",
      },
      {
        id: "tx-s-4",
        date: "2026-09-15",
        description: "Netflix",
        amount: 65,
        currency: "GTQ",
        category: "Suscripciones",
      },
    ];

    const multiMonthTxs: Transaction[] = [
      // Month 1: 2026-07
      { id: "m-1", date: "2026-07-02", description: "La Torre", amount: 1800, currency: "GTQ", category: "Supermercado" },
      { id: "m-2", date: "2026-07-08", description: "San Martin", amount: 500, currency: "GTQ", category: "Restaurantes y Cafés" },
      { id: "m-3", date: "2026-07-12", description: "EEGSA", amount: 350, currency: "GTQ", category: "Servicios Básicos" },
      // Month 2: 2026-08
      { id: "m-4", date: "2026-08-02", description: "La Torre", amount: 2200, currency: "GTQ", category: "Supermercado" },
      { id: "m-5", date: "2026-08-08", description: "San Martin", amount: 700, currency: "GTQ", category: "Restaurantes y Cafés" },
      { id: "m-6", date: "2026-08-12", description: "EEGSA", amount: 370, currency: "GTQ", category: "Servicios Básicos" },
      // Month 3: 2026-09
      { id: "m-7", date: "2026-09-02", description: "La Torre", amount: 2000, currency: "GTQ", category: "Supermercado" },
      { id: "m-8", date: "2026-09-08", description: "San Martin", amount: 600, currency: "GTQ", category: "Restaurantes y Cafés" },
      { id: "m-9", date: "2026-09-12", description: "EEGSA", amount: 360, currency: "GTQ", category: "Servicios Básicos" },
    ];

    it("generates realistic targets within 85% to 105% of average for single-month dataset", () => {
      const plan = generateRealisticBudgetFromTransactions(singleMonthTxs);
      assert.ok(plan);
      assert.strictEqual(plan.createdMode, "transactions");
      assert.ok(plan.targets.length >= 4);

      const averages = computeHistoricalMonthlyCategoryAverages(singleMonthTxs);

      for (const target of plan.targets) {
        const avg = averages[target.categoryName].averageGTQ;
        const ratio = target.monthlyLimitGTQ / avg;

        // Must stay between 85% and 105%
        assert.ok(
          ratio >= 0.85 && ratio <= 1.05,
          `Category ${target.categoryName} ratio ${ratio} not in [0.85, 1.05]`
        );
      }
    });

    it("generates realistic targets within 85% to 105% of average for multi-month dataset", () => {
      const plan = generateRealisticBudgetFromTransactions(multiMonthTxs);
      assert.ok(plan);
      assert.strictEqual(plan.createdMode, "transactions");

      const averages = computeHistoricalMonthlyCategoryAverages(multiMonthTxs);

      // Supermercado avg: (1800 + 2200 + 2000)/3 = 2000
      assert.strictEqual(averages["Supermercado"].averageGTQ, 2000);
      // Servicios Básicos avg: (350 + 370 + 360)/3 = 360
      assert.strictEqual(averages["Servicios Básicos"].averageGTQ, 360);

      const superTarget = plan.targets.find((t) => t.categoryName === "Supermercado");
      assert.ok(superTarget);
      // Variable: 2000 * 0.92 = 1840 -> clean Q25 increment = 1850. Ratio = 1850 / 2000 = 0.925
      const superRatio = superTarget.monthlyLimitGTQ / 2000;
      assert.ok(superRatio >= 0.85 && superRatio <= 1.05);

      const serviciosTarget = plan.targets.find((t) => t.categoryName === "Servicios Básicos");
      assert.ok(serviciosTarget);
      // Fixed: 100% of 360 -> clean Q25 = 350 or 375. Ratio = ~0.97 - 1.04
      const servRatio = serviciosTarget.monthlyLimitGTQ / 360;
      assert.ok(servRatio >= 0.85 && servRatio <= 1.05);
    });

    it("covers fixed commitments realistically near 100% and variable expenses with ~5-10% gentle cut", () => {
      assert.strictEqual(isFixedCommitmentCategory("servicios", "Servicios Básicos"), true);
      assert.strictEqual(isFixedCommitmentCategory("suscripciones", "Suscripciones"), true);
      assert.strictEqual(isFixedCommitmentCategory("restaurantes", "Restaurantes y Cafés"), false);
      assert.strictEqual(isFixedCommitmentCategory("supermercado", "Supermercado"), false);

      const plan = generateRealisticBudgetFromTransactions(singleMonthTxs);
      const serviciosTarget = plan.targets.find((t) => t.categoryName === "Servicios Básicos")!;
      // Fixed: 400 * 1.0 = 400
      assert.strictEqual(serviciosTarget.monthlyLimitGTQ, 400);

      const restTarget = plan.targets.find((t) => t.categoryName === "Restaurantes y Cafés")!;
      // Variable: 600 * 0.92 = 552 -> 550
      assert.strictEqual(restTarget.monthlyLimitGTQ, 550);
      assert.ok(restTarget.monthlyLimitGTQ < 600);
      assert.ok(restTarget.monthlyLimitGTQ >= 600 * 0.9);
    });
  });
});
