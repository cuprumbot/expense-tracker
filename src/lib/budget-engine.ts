import {
  BudgetPlan,
  StoredBudgetState,
  CategoryBudgetTarget,
  MonthBudgetComparison,
  CategoryComparisonResult,
  BudgetFunStats,
} from "@/types/budget";
import { Transaction } from "@/types/transaction";
import defaultCatalog from "@/data/merchant-catalog.json";

export const ESSENTIAL_CATEGORY_IDS = new Set([
  "supermercado",
  "servicios",
  "transporte",
  "salud",
  "educacion",
  "visacuotas_financiamiento",
  "hogar",
]);

/**
 * Determines whether a category belongs to essential living expenses or discretionary leisure.
 */
export function isCategoryEssential(categoryId: string, categoryName: string): boolean {
  if (ESSENTIAL_CATEGORY_IDS.has(categoryId.toLowerCase())) return true;
  const lowerName = categoryName.toLowerCase();
  return (
    lowerName.includes("supermercado") ||
    lowerName.includes("servicios") ||
    lowerName.includes("transporte") ||
    lowerName.includes("salud") ||
    lowerName.includes("farmacia") ||
    lowerName.includes("educaci") ||
    lowerName.includes("visacuota") ||
    lowerName.includes("hogar")
  );
}

export const TIERED_AMOUNT_PRESETS = {
  essential: [1000, 2000, 3000, 4500],
  discretionary: [150, 300, 500, 800],
};

export interface CategoryHistoricalStats {
  averageMonthlyGTQ: number;
  lastMonthGTQ: number;
  goalMinus10GTQ: number;
}

export const FIXED_COMMITMENT_CATEGORIES = new Set([
  "servicios",
  "suscripciones",
  "visacuotas_financiamiento",
  "salud",
  "educacion",
]);

/**
 * Checks whether a category is a fixed commitment where target should stay ~100% of historical average.
 */
export function isFixedCommitmentCategory(categoryId: string, categoryName: string): boolean {
  if (FIXED_COMMITMENT_CATEGORIES.has(categoryId.toLowerCase())) return true;
  const lowerName = categoryName.toLowerCase();
  return (
    lowerName.includes("servicios") ||
    lowerName.includes("suscripci") ||
    lowerName.includes("visacuota") ||
    lowerName.includes("salud") ||
    lowerName.includes("farmacia") ||
    lowerName.includes("educaci")
  );
}

/**
 * Rounds a Quetzal amount to clean increments (nearest Q 25 or Q 50, minimum Q 25).
 */
export function roundToCleanQuetzales(amount: number): number {
  if (amount <= 0) return 0;
  if (amount < 150) return Math.max(10, Math.round(amount / 5) * 5);
  return Math.max(25, Math.round(amount / 25) * 25);
}

/**
 * Computes monthly average expenditures per category across all distinct calendar months in the dataset.
 */
export function computeHistoricalMonthlyCategoryAverages(
  transactions: Transaction[]
): Record<string, { averageGTQ: number; totalGTQ: number; count: number }> {
  if (!transactions || transactions.length === 0) return {};

  const validTxs = transactions.filter(
    (t) => (Number(t.amount) || 0) > 0 && t.category && t.category !== "Pendiente"
  );
  if (validTxs.length === 0) return {};

  const distinctMonths = new Set(
    validTxs.map((t) => (t.date ? t.date.substring(0, 7) : "sin_fecha"))
  );
  const totalMonthsCount = Math.max(1, distinctMonths.size);

  const categoryTotals: Record<string, { totalGTQ: number; count: number }> = {};
  for (const t of validTxs) {
    const cat = t.category!;
    if (!categoryTotals[cat]) {
      categoryTotals[cat] = { totalGTQ: 0, count: 0 };
    }
    categoryTotals[cat].totalGTQ += Number(t.amount) || 0;
    categoryTotals[cat].count += 1;
  }

  const result: Record<string, { averageGTQ: number; totalGTQ: number; count: number }> = {};
  for (const [cat, data] of Object.entries(categoryTotals)) {
    result[cat] = {
      averageGTQ: Math.round(data.totalGTQ / totalMonthsCount),
      totalGTQ: Math.round(data.totalGTQ),
      count: data.count,
    };
  }

  return result;
}

/**
 * Generates a realistic baseline budget from historical transactions.
 * - Fixed/essential categories (~100% of average)
 * - Variable/discretionary categories (90% - 95% of average, gentle optimization)
 * All targets stay comfortably between 85% and 105% of historical averages.
 */
export function generateRealisticBudgetFromTransactions(
  transactions: Transaction[],
  customCategories?: { id: string; name: string }[]
): BudgetPlan {
  const averages = computeHistoricalMonthlyCategoryAverages(transactions);
  const targets: CategoryBudgetTarget[] = [];

  for (const [categoryName, data] of Object.entries(averages)) {
    const avg = data.averageGTQ;
    if (avg <= 0) continue;

    // Resolve categoryId
    let catId = categoryName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const stdMatch = defaultCatalog.categories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase()
    );
    if (stdMatch) {
      catId = stdMatch.id;
    } else if (customCategories) {
      const matchCustom = customCategories.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase()
      );
      if (matchCustom) catId = matchCustom.id;
    }

    const isFixed = isFixedCommitmentCategory(catId, categoryName);
    const isEssential = isCategoryEssential(catId, categoryName);

    // Fixed categories: 100% of average (rounded to clean Q 25/Q 50)
    // Variable categories: 92% of average (gentle 8% optimization)
    const factor = isFixed ? 1.0 : 0.92;
    const targetLimit = roundToCleanQuetzales(avg * factor);

    targets.push({
      categoryId: catId,
      categoryName,
      monthlyLimitGTQ: targetLimit,
      isEssential,
    });
  }

  // Sort targets: essential first, then highest limit
  targets.sort((a, b) => {
    if (a.isEssential && !b.isEssential) return -1;
    if (!a.isEssential && b.isEssential) return 1;
    return b.monthlyLimitGTQ - a.monthlyLimitGTQ;
  });

  const totalMonthlyBudgetGTQ = targets.reduce((sum, t) => sum + t.monthlyLimitGTQ, 0);

  return {
    id: `budget-realistic-${Date.now()}`,
    name: "Presupuesto Realista",
    targets,
    totalMonthlyBudgetGTQ,
    createdMode: "transactions",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Applies a budget update with explicit historical versioning scope.
 * - "all_months": Retroactively updates all months to evaluate against the new budget.
 * - "from_now_on": Preserves past months' budget snapshots and applies the new budget from current/latest month forward.
 */
export function applyBudgetUpdate(
  prevState: StoredBudgetState,
  updatedPlan: BudgetPlan,
  scope: "all_months" | "from_now_on",
  availableMonths: string[] = []
): StoredBudgetState {
  if (scope === "all_months") {
    const newMonthlyBudgets: Record<string, BudgetPlan> = {};
    for (const m of availableMonths) {
      newMonthlyBudgets[m] = { ...updatedPlan };
    }
    return {
      currentBudget: updatedPlan,
      monthlyBudgets: newMonthlyBudgets,
      effectiveFromMonth: null,
    };
  }

  // scope === "from_now_on"
  const sortedMonths = [...availableMonths].sort();
  const currentOrLatestMonth =
    sortedMonths.length > 0
      ? sortedMonths[sortedMonths.length - 1]
      : new Date().toISOString().substring(0, 7);

  const newMonthlyBudgets: Record<string, BudgetPlan> = { ...(prevState.monthlyBudgets || {}) };

  // For any historical month prior to currentOrLatestMonth, ensure it preserves the prior budget
  if (prevState.currentBudget) {
    for (const m of sortedMonths) {
      if (m < currentOrLatestMonth && !newMonthlyBudgets[m]) {
        newMonthlyBudgets[m] = prevState.currentBudget;
      }
    }
  }

  newMonthlyBudgets[currentOrLatestMonth] = updatedPlan;

  return {
    currentBudget: updatedPlan,
    monthlyBudgets: newMonthlyBudgets,
    effectiveFromMonth: currentOrLatestMonth,
  };
}

/**
 * Computes historical spending metrics for a category given a set of transactions.
 */
export function getCategoryHistoricalStats(
  transactions: Transaction[],
  categoryName: string
): CategoryHistoricalStats | null {
  if (!transactions || transactions.length === 0) return null;

  const relevant = transactions.filter(
    (t) => t.category?.toLowerCase() === categoryName.toLowerCase()
  );
  if (relevant.length === 0) return null;

  // Group by YYYY-MM
  const monthTotals: Record<string, number> = {};
  for (const t of relevant) {
    const month = t.date ? t.date.substring(0, 7) : "sin_fecha";
    monthTotals[month] = (monthTotals[month] || 0) + (Number(t.amount) || 0);
  }

  const months = Object.keys(monthTotals).sort();
  if (months.length === 0) return null;

  const sumTotal = Object.values(monthTotals).reduce((a, b) => a + b, 0);
  const averageMonthlyGTQ = Math.round(sumTotal / months.length);
  const latestMonth = months[months.length - 1];
  const lastMonthGTQ = Math.round(monthTotals[latestMonth]);
  const goalMinus10GTQ = Math.max(25, Math.round((averageMonthlyGTQ * 0.9) / 25) * 25);

  return {
    averageMonthlyGTQ,
    lastMonthGTQ,
    goalMinus10GTQ,
  };
}

/**
 * Returns the exact BudgetPlan applicable to any given "YYYY-MM" month.
 * Priority:
 * 1. An explicit snapshot stored in monthlyBudgets[monthKey].
 * 2. If no explicit snapshot, fall back to currentBudget if either:
 *    - effectiveFromMonth is not specified, OR
 *    - monthKey is greater than or equal to effectiveFromMonth.
 * 3. Returns null if no budget plan is valid for that month.
 */
export function getBudgetForMonth(
  state: StoredBudgetState | null,
  monthKey: string
): BudgetPlan | null {
  if (!state) return null;

  if (state.monthlyBudgets && state.monthlyBudgets[monthKey]) {
    return state.monthlyBudgets[monthKey];
  }

  if (state.currentBudget) {
    if (!state.effectiveFromMonth || monthKey >= state.effectiveFromMonth) {
      return state.currentBudget;
    }
  }

  return null;
}

const SPANISH_MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/**
 * Formats a "YYYY-MM" month key into clean Spanish text (e.g. "2026-09" -> "Septiembre 2026").
 */
export function formatMonthSpanish(monthKey: string): string {
  if (!monthKey || !monthKey.includes("-")) return monthKey;
  const parts = monthKey.split("-");
  const year = parts[0];
  const monthNum = parseInt(parts[1], 10);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return monthKey;
  return `${SPANISH_MONTH_NAMES[monthNum - 1]} ${year}`;
}

/**
 * Compares an uploaded month's actual expenses against its applicable budget plan.
 */
export function compareMonthAgainstBudget(
  transactions: Transaction[],
  monthKey: string,
  budgetPlan: BudgetPlan
): MonthBudgetComparison {
  const monthTxs = (transactions || []).filter(
    (t) => t.date && t.date.startsWith(monthKey) && t.amount > 0
  );

  // Accumulate spending by category (exact match, case-insensitive)
  const actualByCategory = new Map<string, number>();
  for (const t of monthTxs) {
    const rawCategory = t.category?.trim() || "Otros";
    const current = actualByCategory.get(rawCategory) || 0;
    actualByCategory.set(rawCategory, current + t.amount);
  }

  // Calculate comparisons for each budgeted target
  const categoryComparisons: CategoryComparisonResult[] = [];
  const processedCategoryNames = new Set<string>();

  for (const target of budgetPlan.targets) {
    const key = target.categoryName;
    let actualGTQ = 0;
    for (const [catName, amount] of actualByCategory.entries()) {
      if (catName.toLowerCase() === key.toLowerCase()) {
        actualGTQ += amount;
        processedCategoryNames.add(catName.toLowerCase());
      }
    }

    const budgetedGTQ = target.monthlyLimitGTQ;
    const differenceGTQ = actualGTQ - budgetedGTQ;
    const remainingGTQ = budgetedGTQ - actualGTQ;
    const utilizationPercent =
      budgetedGTQ > 0 ? (actualGTQ / budgetedGTQ) * 100 : actualGTQ > 0 ? 100 : 0;

    let status: "under" | "near" | "over" | "way_over" = "under";
    if (utilizationPercent >= 125) {
      status = "way_over";
    } else if (utilizationPercent > 100) {
      status = "over";
    } else if (utilizationPercent > 90) {
      status = "near";
    } else {
      status = "under";
    }

    categoryComparisons.push({
      categoryId: target.categoryId,
      categoryName: target.categoryName,
      budgetedGTQ,
      actualGTQ: Math.round(actualGTQ * 100) / 100,
      differenceGTQ: Math.round(differenceGTQ * 100) / 100,
      remainingGTQ: Math.round(remainingGTQ * 100) / 100,
      utilizationPercent: Math.round(utilizationPercent * 10) / 10,
      status,
      isEssential: target.isEssential,
    });
  }

  // Sort comparisons: over/way_over first, then highest actualGTQ
  categoryComparisons.sort((a, b) => {
    const isOverA = a.status === "over" || a.status === "way_over" ? 1 : 0;
    const isOverB = b.status === "over" || b.status === "way_over" ? 1 : 0;
    if (isOverA !== isOverB) return isOverB - isOverA;
    return b.actualGTQ - a.actualGTQ;
  });

  // Identify unbudgeted categories
  const unbudgetedCategories: { categoryName: string; actualGTQ: number }[] = [];
  for (const [catName, spent] of actualByCategory.entries()) {
    if (!processedCategoryNames.has(catName.toLowerCase()) && spent > 0) {
      unbudgetedCategories.push({
        categoryName: catName,
        actualGTQ: Math.round(spent * 100) / 100,
      });
    }
  }
  unbudgetedCategories.sort((a, b) => b.actualGTQ - a.actualGTQ);

  const totalBudgetedGTQ = budgetPlan.totalMonthlyBudgetGTQ;
  const totalSpentGTQ = Math.round(monthTxs.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;
  const remainingGTQ = Math.round((totalBudgetedGTQ - totalSpentGTQ) * 100) / 100;
  const utilizationPercent =
    totalBudgetedGTQ > 0
      ? Math.round((totalSpentGTQ / totalBudgetedGTQ) * 1000) / 10
      : totalSpentGTQ > 0
      ? 100
      : 0;

  return {
    monthKey,
    budgetPlan,
    totalBudgetedGTQ,
    totalSpentGTQ,
    remainingGTQ,
    utilizationPercent,
    categoryComparisons,
    unbudgetedCategories,
  };
}

/**
 * Calculates gamified budget statistics including weekly streaks, category goal tallies, and savings highlights.
 */
export function calculateBudgetFunStats(
  transactions: Transaction[],
  budgetState: StoredBudgetState,
  selectedMonthKey: string
): BudgetFunStats {
  const validTxs = (transactions || []).filter(
    (t) => t.date && t.date.length >= 10 && t.amount > 0
  );

  // 1. Weekly Streak Calculation (semanasEnRacha)
  let currentStreak = 0;
  let bestStreak = 0;

  if (validTxs.length > 0) {
    const weekSpendMap = new Map<string, number>();

    for (const t of validTxs) {
      const parts = t.date.substring(0, 10).split("-").map((p) => parseInt(p, 10));
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      const day = d.getUTCDay();
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(d.getTime() - diffToMonday * 86400000);
      const weekKey = monday.toISOString().substring(0, 10);

      weekSpendMap.set(weekKey, (weekSpendMap.get(weekKey) || 0) + t.amount);
    }

    const sortedWeeks = Array.from(weekSpendMap.keys()).sort();

    for (const weekKey of sortedWeeks) {
      const spent = weekSpendMap.get(weekKey) || 0;
      const monthKey = weekKey.substring(0, 7);
      const applicablePlan =
        getBudgetForMonth(budgetState, monthKey) || budgetState.currentBudget;

      const monthlyBudget = applicablePlan?.totalMonthlyBudgetGTQ || 0;
      const weeklyBudget = monthlyBudget > 0 ? monthlyBudget / 4.33 : 0;

      if (weeklyBudget > 0) {
        if (spent <= weeklyBudget) {
          currentStreak += 1;
          if (currentStreak > bestStreak) {
            bestStreak = currentStreak;
          }
        } else {
          currentStreak = 0;
        }
      }
    }
  }

  // 2. Categories Met Goal in Selected Month (categoriasCumplidas) & 3. Best Performing Category (mejorCategoria)
  const monthPlan =
    getBudgetForMonth(budgetState, selectedMonthKey) || budgetState.currentBudget;

  let metCount = 0;
  let totalBudgetedCount = 0;
  let mejorCategoria: {
    categoryName: string;
    savedAmountGTQ: number;
    savedPercent: number;
  } | null = null;

  if (monthPlan && monthPlan.targets && monthPlan.targets.length > 0) {
    totalBudgetedCount = monthPlan.targets.length;

    const monthTxs = validTxs.filter((t) => t.date.startsWith(selectedMonthKey));
    const actualByCategory = new Map<string, number>();

    for (const t of monthTxs) {
      const cat = t.category?.trim().toLowerCase() || "otros";
      actualByCategory.set(cat, (actualByCategory.get(cat) || 0) + t.amount);
    }

    let maxSavedGTQ = -1;

    for (const target of monthPlan.targets) {
      const actual = actualByCategory.get(target.categoryName.toLowerCase()) || 0;
      if (actual <= target.monthlyLimitGTQ) {
        metCount += 1;
      }

      const savedGTQ = target.monthlyLimitGTQ - actual;
      if (savedGTQ > 0 && savedGTQ > maxSavedGTQ) {
        maxSavedGTQ = savedGTQ;
        const savedPercent =
          target.monthlyLimitGTQ > 0 ? (savedGTQ / target.monthlyLimitGTQ) * 100 : 0;
        mejorCategoria = {
          categoryName: target.categoryName,
          savedAmountGTQ: Math.round(savedGTQ * 100) / 100,
          savedPercent: Math.round(savedPercent * 10) / 10,
        };
      }
    }
  }

  // 4. Months Within Overall Budget (mesesDentroDePresupuesto)
  const monthSpendMap = new Map<string, number>();
  for (const t of validTxs) {
    const m = t.date.substring(0, 7);
    monthSpendMap.set(m, (monthSpendMap.get(m) || 0) + t.amount);
  }

  let monthsMetCount = 0;
  let totalMonthsCount = 0;

  for (const [m, spent] of monthSpendMap.entries()) {
    const plan = getBudgetForMonth(budgetState, m) || budgetState.currentBudget;
    if (plan && plan.totalMonthlyBudgetGTQ > 0) {
      totalMonthsCount += 1;
      if (spent <= plan.totalMonthlyBudgetGTQ) {
        monthsMetCount += 1;
      }
    }
  }

  return {
    semanasEnRacha: {
      currentStreak,
      bestStreak,
    },
    categoriasCumplidas: {
      metCount,
      totalBudgetedCount,
    },
    mejorCategoria,
    mesesDentroDePresupuesto: {
      metCount: monthsMetCount,
      totalMonthsCount,
    },
  };
}
