import { Transaction } from "@/types/transaction";

export interface CategoryReportItem {
  category: string;
  total: number;
  count: number;
  percentage: number;
  isTopCategory: boolean;
}

export interface ReportingMetrics {
  totalSpend: number;
  totalTransactionsCount: number;
  classifiedCount: number;
  pendingCount: number;
  isFullyClassified: boolean;
  topCategory: CategoryReportItem | null;
  categories: CategoryReportItem[];
}

/**
 * Calculates aggregated financial reporting metrics for classified expenses.
 * Operates purely client-side conforming to the Split-Brain privacy boundary.
 */
export function calculateReportingMetrics(
  transactions: Transaction[]
): ReportingMetrics {
  let classifiedCount = 0;
  let pendingCount = 0;
  let totalSpend = 0;
  const categoryMap: Record<string, { total: number; count: number }> = {};

  for (const tx of transactions) {
    const cat = tx.category || "Pendiente";
    const isPending = cat === "Pendiente";
    const amount = Number(tx.amount) || 0;

    totalSpend += amount;
    if (isPending) {
      pendingCount++;
    } else {
      classifiedCount++;
    }

    if (!categoryMap[cat]) {
      categoryMap[cat] = { total: 0, count: 0 };
    }
    categoryMap[cat].total += amount;
    categoryMap[cat].count += 1;
  }

  totalSpend = Math.round(totalSpend * 100) / 100;

  const sortedCategories = Object.entries(categoryMap)
    .map(([category, { total, count }]) => {
      const roundedTotal = Math.round(total * 100) / 100;
      const percentage =
        totalSpend > 0
          ? Math.round((roundedTotal / totalSpend) * 1000) / 10
          : 0;
      return {
        category,
        total: roundedTotal,
        count,
        percentage,
        isTopCategory: false,
      };
    })
    .sort((a, b) => {
      if (a.category === "Pendiente") return 1;
      if (b.category === "Pendiente") return -1;
      return b.total - a.total;
    });

  const firstNonPending = sortedCategories.find(
    (c) => c.category !== "Pendiente"
  );
  if (firstNonPending && firstNonPending.total > 0) {
    firstNonPending.isTopCategory = true;
  }

  return {
    totalSpend,
    totalTransactionsCount: transactions.length,
    classifiedCount,
    pendingCount,
    isFullyClassified: transactions.length > 0 && pendingCount === 0,
    topCategory: firstNonPending || null,
    categories: sortedCategories,
  };
}

/**
 * Filters transactions by category and search keyword.
 */
export function filterTransactions(
  transactions: Transaction[],
  filters: {
    category?: string;
    searchTerm?: string;
  }
): Transaction[] {
  const { category, searchTerm } = filters;
  const normalizedSearch = searchTerm?.trim().toLowerCase();

  return transactions.filter((tx) => {
    if (category && category !== "all") {
      const txCat = tx.category || "Pendiente";
      if (txCat !== category) return false;
    }

    if (normalizedSearch) {
      const desc = (tx.description || "").toLowerCase();
      if (!desc.includes(normalizedSearch)) return false;
    }

    return true;
  });
}
