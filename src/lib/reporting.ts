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
    currency?: "all" | "GTQ" | "USD" | string;
  }
): Transaction[] {
  const { category, searchTerm, currency } = filters;
  const normalizedSearch = searchTerm?.trim().toLowerCase();

  return transactions.filter((tx) => {
    if (category && category !== "all") {
      const txCat = tx.category || "Pendiente";
      if (txCat !== category) return false;
    }

    if (currency && currency !== "all") {
      if (currency === "USD") {
        if (tx.originalCurrency !== "USD") return false;
      } else if (currency === "GTQ") {
        if (tx.originalCurrency === "USD") return false;
      }
    }

    if (normalizedSearch) {
      const desc = (tx.description || "").toLowerCase();
      if (!desc.includes(normalizedSearch)) return false;
    }

    return true;
  });
}

export interface CategoryMonthlyTotal {
  monthKey: string;      // "2026-06"
  monthLabel: string;    // "Jun 2026"
  totalAmount: number;   // 1450.50
}

export interface CategoryMonthlyTrend {
  categoryId: string;
  categoryName: string;
  color: string;
  monthlyTotals: CategoryMonthlyTotal[];
}

export interface MonthlyCategoryTrendsResult {
  months: Array<{
    monthKey: string;      // "2026-06"
    monthLabel: string;    // "Jun 2026"
  }>;
  trends: CategoryMonthlyTrend[];
  isSingleMonth: boolean;
  peakAmount: number;
}

export const SPANISH_SHORT_MONTHS: Record<string, string> = {
  "01": "Ene",
  "02": "Feb",
  "03": "Mar",
  "04": "Abr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Ago",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dic",
};

export const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  Supermercado: "#10b981",
  "Restaurantes y Cafés": "#f59e0b",
  "Servicios Básicos": "#3b82f6",
  "Transporte y Combustible": "#f97316",
  "Salud y Farmacia": "#14b8a6",
  "Entretenimiento y Compras": "#8b5cf6",
  Suscripciones: "#6366f1",
  "Tecnología y Computación": "#06b6d4",
  "Hogar y Mascotas": "#84cc16",
  Educación: "#ec4899",
  "Ropa y Calzado": "#d946ef",
  "Viajes y Turismo": "#0ea5e9",
  "Vehículo y Mantenimiento": "#64748b",
  "Cuidado Personal y Belleza": "#f43f5e",
  "Visacuotas y Financiamiento": "#0284c7",
  Pendiente: "#71717a",
};

export function formatMonthKeyToLabel(monthKey: string): string {
  const parts = monthKey.split("-");
  if (parts.length === 2) {
    const [year, month] = parts;
    const name = SPANISH_SHORT_MONTHS[month] || month;
    return `${name} ${year}`;
  }
  return monthKey;
}

export function extractMonthKey(dateStr: string): string {
  if (!dateStr) return "2026-01";
  const parts = dateStr.trim().split(/[-/.]/);
  // YYYY-MM-DD
  if (parts.length >= 2 && parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, "0")}`;
  }
  // DD-MM-YYYY
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}`;
  }
  return dateStr.substring(0, 7);
}

/**
 * Calculates multi-month category time-series trend aggregations.
 * Pure mathematical aggregation adhering 100% to Split-Brain local execution.
 */
export function calculateMonthlyCategoryTrends(
  transactions: Transaction[],
  customCategories: import("@/types/transaction").CustomCategory[] = []
): MonthlyCategoryTrendsResult {
  // 1. Filter out invalid/negative transactions (credits, payments)
  const validExpenses = transactions.filter(
    (tx) => typeof tx.amount === "number" && tx.amount > 0
  );

  // 2. Identify all distinct calendar months present in transactions
  const monthKeySet = new Set<string>();
  for (const tx of validExpenses) {
    monthKeySet.add(extractMonthKey(tx.date));
  }

  // Sort distinct months chronologically (lexicographical sorting on YYYY-MM matches chronological order)
  const sortedMonthKeys = Array.from(monthKeySet).sort();
  const months = sortedMonthKeys.map((monthKey) => ({
    monthKey,
    monthLabel: formatMonthKeyToLabel(monthKey),
  }));

  if (months.length === 0) {
    return {
      months: [],
      trends: [],
      isSingleMonth: true,
      peakAmount: 0,
    };
  }

  // 3. Map categories and their month totals
  // categoryName -> { totalSpend: number, monthTotals: Record<monthKey, number> }
  const categoryData: Record<
    string,
    { overallTotal: number; monthTotals: Record<string, number> }
  > = {};

  for (const tx of validExpenses) {
    const cat = tx.category || "Pendiente";
    const monthKey = extractMonthKey(tx.date);

    if (!categoryData[cat]) {
      categoryData[cat] = { overallTotal: 0, monthTotals: {} };
    }
    categoryData[cat].overallTotal += tx.amount;
    categoryData[cat].monthTotals[monthKey] =
      (categoryData[cat].monthTotals[monthKey] || 0) + tx.amount;
  }

  // Helper to resolve category color
  const resolveCategoryColor = (categoryName: string): string => {
    const custom = customCategories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase()
    );
    if (custom && custom.color) {
      return custom.color;
    }
    if (DEFAULT_CATEGORY_COLORS[categoryName]) {
      return DEFAULT_CATEGORY_COLORS[categoryName];
    }
    // Deterministic fallback color
    return "#64748b";
  };

  // Sort categories by total overall spend descending, placing "Pendiente" at the end if present
  const sortedCategories = Object.keys(categoryData).sort((a, b) => {
    if (a === "Pendiente") return 1;
    if (b === "Pendiente") return -1;
    return categoryData[b].overallTotal - categoryData[a].overallTotal;
  });

  let peakAmount = 0;

  // Build aligned trend series for each active category
  const trends: CategoryMonthlyTrend[] = sortedCategories.map((catName) => {
    const data = categoryData[catName];
    const monthlyTotals: CategoryMonthlyTotal[] = sortedMonthKeys.map(
      (monthKey) => {
        const rawTotal = data.monthTotals[monthKey] || 0;
        const totalAmount = Number(rawTotal.toFixed(2));
        if (totalAmount > peakAmount) {
          peakAmount = totalAmount;
        }
        return {
          monthKey,
          monthLabel: formatMonthKeyToLabel(monthKey),
          totalAmount,
        };
      }
    );

    return {
      categoryId: catName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      categoryName: catName,
      color: resolveCategoryColor(catName),
      monthlyTotals,
    };
  });

  return {
    months,
    trends,
    isSingleMonth: months.length <= 1,
    peakAmount,
  };
}
