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
  applyBudgetUpdate,
  compareMonthAgainstBudget,
  formatMonthSpanish,
} from "./budget-engine";
import { Transaction } from "@/types/transaction";
import { BudgetPlan, StoredBudgetState } from "@/types/budget";

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

  describe("US-058: Budget Editing Workflow & Historical Application Scopes", () => {
    const initialPlan: BudgetPlan = {
      id: "plan-v1",
      name: "Presupuesto Inicial",
      targets: [
        { categoryId: "supermercado", categoryName: "Supermercado", monthlyLimitGTQ: 2000, isEssential: true },
        { categoryId: "restaurantes", categoryName: "Restaurantes y Cafés", monthlyLimitGTQ: 500, isEssential: false },
      ],
      totalMonthlyBudgetGTQ: 2500,
      createdMode: "zero",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };

    const updatedPlan: BudgetPlan = {
      id: "plan-v2",
      name: "Presupuesto Actualizado",
      targets: [
        { categoryId: "supermercado", categoryName: "Supermercado", monthlyLimitGTQ: 2500, isEssential: true },
        { categoryId: "restaurantes", categoryName: "Restaurantes y Cafés", monthlyLimitGTQ: 300, isEssential: false },
      ],
      totalMonthlyBudgetGTQ: 2800,
      createdMode: "zero",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };

    it("scope 'all_months' updates all historical months and effectiveFromMonth is null", () => {
      const prevState: StoredBudgetState = {
        currentBudget: initialPlan,
        monthlyBudgets: {},
        effectiveFromMonth: null,
      };

      const months = ["2026-07", "2026-08", "2026-09"];
      const newState = applyBudgetUpdate(prevState, updatedPlan, "all_months", months);

      assert.strictEqual(newState.currentBudget?.totalMonthlyBudgetGTQ, 2800);
      assert.strictEqual(newState.effectiveFromMonth, null);

      // All months should resolve to updatedPlan (2800)
      for (const m of months) {
        const resolved = getBudgetForMonth(newState, m);
        assert.ok(resolved);
        assert.strictEqual(resolved?.totalMonthlyBudgetGTQ, 2800);
        assert.strictEqual(resolved?.targets[0].monthlyLimitGTQ, 2500);
      }

      // Future month also resolves to currentBudget (2800)
      const futureResolved = getBudgetForMonth(newState, "2026-10");
      assert.strictEqual(futureResolved?.totalMonthlyBudgetGTQ, 2800);
    });

    it("scope 'from_now_on' preserves prior month snapshots and updates from current month onward", () => {
      const prevState: StoredBudgetState = {
        currentBudget: initialPlan,
        monthlyBudgets: {},
        effectiveFromMonth: null,
      };

      const months = ["2026-07", "2026-08", "2026-09"];
      const newState = applyBudgetUpdate(prevState, updatedPlan, "from_now_on", months);

      assert.strictEqual(newState.currentBudget?.totalMonthlyBudgetGTQ, 2800);
      assert.strictEqual(newState.effectiveFromMonth, "2026-09");

      // Prior months (2026-07 and 2026-08) preserve the initialPlan (2500)
      const julyBudget = getBudgetForMonth(newState, "2026-07");
      assert.strictEqual(julyBudget?.totalMonthlyBudgetGTQ, 2500);
      assert.strictEqual(julyBudget?.targets[0].monthlyLimitGTQ, 2000);

      const augBudget = getBudgetForMonth(newState, "2026-08");
      assert.strictEqual(augBudget?.totalMonthlyBudgetGTQ, 2500);

      // Current month (2026-09) and onward resolve to updatedPlan (2800)
      const sepBudget = getBudgetForMonth(newState, "2026-09");
      assert.strictEqual(sepBudget?.totalMonthlyBudgetGTQ, 2800);
      assert.strictEqual(sepBudget?.targets[0].monthlyLimitGTQ, 2500);

      const octBudget = getBudgetForMonth(newState, "2026-10");
      assert.strictEqual(octBudget?.totalMonthlyBudgetGTQ, 2800);
    });

    it("handles empty availableMonths gracefully in applyBudgetUpdate", () => {
      const prevState: StoredBudgetState = {
        currentBudget: initialPlan,
        monthlyBudgets: {},
        effectiveFromMonth: null,
      };

      const newState = applyBudgetUpdate(prevState, updatedPlan, "from_now_on", []);
      assert.strictEqual(newState.currentBudget?.totalMonthlyBudgetGTQ, 2800);
      assert.ok(newState.effectiveFromMonth);
    });
  });

  describe("US-059: Monthly Budget vs Actual Expense Comparison Engine", () => {
    it("formats month keys into clean Spanish month names", () => {
      assert.strictEqual(formatMonthSpanish("2026-09"), "Septiembre 2026");
      assert.strictEqual(formatMonthSpanish("2026-01"), "Enero 2026");
      assert.strictEqual(formatMonthSpanish("2026-12"), "Diciembre 2026");
      assert.strictEqual(formatMonthSpanish("invalid"), "invalid");
    });

    it("accurately compares a month against its budget plan with category statuses and unbudgeted warnings", () => {
      const budgetPlan: BudgetPlan = {
        id: "plan-test",
        name: "Presupuesto Test",
        targets: [
          // Target 1: Under budget (spent 800 <= 90% of 1000)
          { categoryId: "supermercado", categoryName: "Supermercado", monthlyLimitGTQ: 1000, isEssential: true },
          // Target 2: Near limit (spent 950 > 90% and <= 100% of 1000)
          { categoryId: "transporte", categoryName: "Transporte y Combustible", monthlyLimitGTQ: 1000, isEssential: true },
          // Target 3: Over limit (spent 1100 > 100% and < 125% of 1000)
          { categoryId: "restaurantes", categoryName: "Restaurantes y Cafés", monthlyLimitGTQ: 1000, isEssential: false },
          // Target 4: Way over limit (spent 1500 >= 125% of 1000)
          { categoryId: "suscripciones", categoryName: "Suscripciones", monthlyLimitGTQ: 1000, isEssential: false },
        ],
        totalMonthlyBudgetGTQ: 4000,
        createdMode: "zero",
        updatedAt: "2026-09-01T00:00:00.000Z",
      };

      const transactions: Transaction[] = [
        // Supermercado: 800 (80% -> under)
        { id: "1", date: "2026-09-02", description: "Supermercado", amount: 800, currency: "GTQ", category: "Supermercado" },
        // Transporte: 950 (95% -> near)
        { id: "2", date: "2026-09-05", description: "Gasolina", amount: 950, currency: "GTQ", category: "Transporte y Combustible" },
        // Restaurantes: 1100 (110% -> over)
        { id: "3", date: "2026-09-10", description: "Almuerzo", amount: 1100, currency: "GTQ", category: "Restaurantes y Cafés" },
        // Suscripciones: 1500 (150% -> way_over)
        { id: "4", date: "2026-09-12", description: "Plataformas", amount: 1500, currency: "GTQ", category: "Suscripciones" },
        // Unbudgeted Category: Salud y Farmacia: 300
        { id: "5", date: "2026-09-15", description: "Farmacia", amount: 300, currency: "GTQ", category: "Salud y Farmacia" },
        // Other month transaction (should be excluded)
        { id: "6", date: "2026-08-15", description: "Supermercado Agosto", amount: 2000, currency: "GTQ", category: "Supermercado" },
      ];

      const result = compareMonthAgainstBudget(transactions, "2026-09", budgetPlan);

      // Total Budgeted: 4000
      assert.strictEqual(result.totalBudgetedGTQ, 4000);
      // Total Spent: 800 + 950 + 1100 + 1500 + 300 = 4650
      assert.strictEqual(result.totalSpentGTQ, 4650);
      // Remaining: 4000 - 4650 = -650 (over budget)
      assert.strictEqual(result.remainingGTQ, -650);
      // Utilization: (4650 / 4000) * 100 = 116.3%
      assert.strictEqual(result.utilizationPercent, 116.3);

      // Category checks
      const superComp = result.categoryComparisons.find((c) => c.categoryName === "Supermercado")!;
      assert.strictEqual(superComp.actualGTQ, 800);
      assert.strictEqual(superComp.budgetedGTQ, 1000);
      assert.strictEqual(superComp.remainingGTQ, 200);
      assert.strictEqual(superComp.status, "under");

      const transComp = result.categoryComparisons.find((c) => c.categoryName === "Transporte y Combustible")!;
      assert.strictEqual(transComp.actualGTQ, 950);
      assert.strictEqual(transComp.remainingGTQ, 50);
      assert.strictEqual(transComp.status, "near");

      const restComp = result.categoryComparisons.find((c) => c.categoryName === "Restaurantes y Cafés")!;
      assert.strictEqual(restComp.actualGTQ, 1100);
      assert.strictEqual(restComp.remainingGTQ, -100);
      assert.strictEqual(restComp.differenceGTQ, 100);
      assert.strictEqual(restComp.status, "over");

      const suscComp = result.categoryComparisons.find((c) => c.categoryName === "Suscripciones")!;
      assert.strictEqual(suscComp.actualGTQ, 1500);
      assert.strictEqual(suscComp.remainingGTQ, -500);
      assert.strictEqual(suscComp.status, "way_over");

      // Unbudgeted category check
      assert.strictEqual(result.unbudgetedCategories.length, 1);
      assert.strictEqual(result.unbudgetedCategories[0].categoryName, "Salud y Farmacia");
      assert.strictEqual(result.unbudgetedCategories[0].actualGTQ, 300);
    });
  });
});
