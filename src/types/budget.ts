/**
 * Canonical Budget interfaces for Iteration 4 Budgeting Tool.
 */

export interface CategoryBudgetTarget {
  categoryId: string;
  categoryName: string;
  monthlyLimitGTQ: number;
  isEssential?: boolean;
}

export interface BudgetPlan {
  id: string;
  name?: string;
  targets: CategoryBudgetTarget[];
  totalMonthlyBudgetGTQ: number;
  createdMode: "zero" | "transactions";
  updatedAt: string;
}

export interface StoredBudgetState {
  currentBudget: BudgetPlan | null;
  monthlyBudgets: Record<string, BudgetPlan>;
  effectiveFromMonth?: string | null;
}

export interface CategoryComparisonResult {
  categoryId: string;
  categoryName: string;
  budgetedGTQ: number;
  actualGTQ: number;
  differenceGTQ: number; // actualGTQ - budgetedGTQ (>0 is over budget, <0 is under)
  remainingGTQ: number; // budgetedGTQ - actualGTQ (>0 is savings remaining, <0 is excess)
  utilizationPercent: number; // (actualGTQ / budgetedGTQ) * 100
  status: "under" | "near" | "over" | "way_over";
  isEssential?: boolean;
}

export interface MonthBudgetComparison {
  monthKey: string;
  budgetPlan: BudgetPlan;
  totalBudgetedGTQ: number;
  totalSpentGTQ: number;
  remainingGTQ: number;
  utilizationPercent: number;
  categoryComparisons: CategoryComparisonResult[];
  unbudgetedCategories: {
    categoryName: string;
    actualGTQ: number;
  }[];
}

export interface BudgetFunStats {
  semanasEnRacha: {
    currentStreak: number;
    bestStreak: number;
  };
  categoriasCumplidas: {
    metCount: number;
    totalBudgetedCount: number;
  };
  mejorCategoria: {
    categoryName: string;
    savedAmountGTQ: number;
    savedPercent: number;
  } | null;
  mesesDentroDePresupuesto: {
    metCount: number;
    totalMonthsCount: number;
  };
}

export type RootCauseType =
  | "compra_unica_alta"
  | "alta_frecuencia"
  | "concentracion_fechas"
  | "monto_total_elevado";

export interface BudgetSuggestion {
  id: string;
  type: "over_budget_cause" | "short_term_improvement" | "long_term_mastery";
  categoryName: string;
  excessAmountGTQ?: number;
  rootCause?: RootCauseType;
  title: string;
  description: string;
  actionableRecommendation: string;
  highlightedTransaction?: {
    merchant: string;
    date: string;
    amountGTQ: number;
  };
  metrics?: {
    previousSpentGTQ?: number;
    currentSpentGTQ?: number;
    targetGTQ?: number;
    consecutiveMonths?: number;
    suggestedNextCategory?: string;
  };
}
