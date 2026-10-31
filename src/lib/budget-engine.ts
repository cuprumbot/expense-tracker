import {
  BudgetPlan,
  StoredBudgetState,
} from "@/types/budget";

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
