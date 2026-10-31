import {
  BudgetPlan,
  StoredBudgetState,
  CategoryBudgetTarget,
} from "@/types/budget";
import { Transaction } from "@/types/transaction";

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
