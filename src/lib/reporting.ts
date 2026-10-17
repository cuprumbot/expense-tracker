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

export interface VendorAggregationItem {
  merchantName: string;
  totalAmountGTQ: number;
  transactionCount: number;
  percentageShare: number;
  averageTicketGTQ: number;
  category: string;
}

export interface TopVendorsResult {
  totalSpendGTQ: number;
  totalTransactionsCount: number;
  byAmount: VendorAggregationItem[];
  byFrequency: VendorAggregationItem[];
}

/**
 * Normalizes merchant descriptions by stripping prefixes, POS numbers, branch suffixes, and dates.
 */
export function normalizeMerchantName(description: string): string {
  if (!description) return "Desconocido";

  let desc = description.trim();

  // Strip POS terminal split with backslashes
  if (desc.includes("\\")) {
    desc = desc.split("\\")[0];
  }

  // Strip common bank and POS prefixes
  desc = desc.replace(/^(POS|COMPRA EN|ESTBL|ESTABLECIMIENTO|PAGO EN|CARGO|DEBITO|COMPRA)\s*[:-]?\s*/i, "");

  // Match and normalize known top Guatemalan brands
  const lower = desc.toLowerCase();
  if (lower.includes("la torre")) return "Supermercados La Torre";
  if (lower.includes("paiz")) return "Supermercados Paiz";
  if (lower.includes("walmart") || lower.includes("wal-mart")) return "Walmart";
  if (lower.includes("despensa familiar")) return "Despensa Familiar";
  if (lower.includes("san martin") || lower.includes("san martín")) return "San Martín";
  if (lower.includes("pollo campero") || lower.includes("campero")) return "Pollo Campero";
  if (lower.includes("mcdonald")) return "McDonald's";
  if (lower.includes("starbucks")) return "Starbucks";
  if (lower.includes("barista")) return "Café Barista";
  if (lower.includes("netflix")) return "Netflix";
  if (lower.includes("spotify")) return "Spotify";
  if (lower.includes("uber trip") || lower.includes("uber *")) return "Uber";
  if (lower.includes("uber eats")) return "Uber Eats";
  if (lower.includes("shell")) return "Shell";
  if (lower.includes("puma")) return "Puma Energy";
  if (lower.includes("texaco")) return "Texaco";
  if (lower.includes("claro")) return "Claro";
  if (lower.includes("tigo")) return "Tigo";
  if (lower.includes("dollarcity") || lower.includes("dollar city")) return "Dollarcity";
  if (lower.includes("pricesmart")) return "PriceSmart";

  // Remove terminal and card info: e.g. TERM 123, NO. 55, #1234
  desc = desc.replace(/\b(TERM|TERMINAL|NO\.|POS|TRANS|REF)\s*#?\d+\b/gi, "");

  // Remove trailing branch identifiers like ZONA 10, Z.14, LOCAL 102, SUCURSAL, GTM, GUA
  desc = desc.replace(/\s+(ZONA|Z\.)\s*\d+.*$/i, "");
  desc = desc.replace(/\s+(LOCAL|SUC\.|SUCURSAL)\s*#?\w+.*$/i, "");
  desc = desc.replace(/\s+(GTM|GUA|GT)$/i, "");

  // Remove trailing date stamps or card digits
  desc = desc.replace(/\s+\d{2}[-/]\d{2}([-/]\d{2,4})?$/i, "");
  desc = desc.replace(/\s+\*{2,}\d{2,}$/, "");

  // Clean trailing punctuation and collapse spaces
  desc = desc.replace(/[#*._-]+$/, "").replace(/\s+/g, " ").trim();

  return desc || description.trim();
}

/**
 * Calculates top vendors by spend volume and purchase frequency.
 * Pure TypeScript logic operating 100% locally.
 */
export function calculateTopVendors(
  transactions: Transaction[],
  limit: number = 5
): TopVendorsResult {
  const validExpenses = transactions.filter(
    (tx) => typeof tx.amount === "number" && tx.amount > 0
  );

  const totalSpendGTQ = Number(
    validExpenses.reduce((acc, tx) => acc + tx.amount, 0).toFixed(2)
  );
  const totalTransactionsCount = validExpenses.length;

  if (validExpenses.length === 0) {
    return {
      totalSpendGTQ: 0,
      totalTransactionsCount: 0,
      byAmount: [],
      byFrequency: [],
    };
  }

  // Merchant aggregation map
  // merchantName -> { totalAmount: number, count: number, categoryCounts: Record<string, number> }
  const merchantMap: Record<
    string,
    { totalAmount: number; count: number; categoryCounts: Record<string, number> }
  > = {};

  for (const tx of validExpenses) {
    const merchantName = normalizeMerchantName(tx.description);
    const cat = tx.category || "Pendiente";

    if (!merchantMap[merchantName]) {
      merchantMap[merchantName] = {
        totalAmount: 0,
        count: 0,
        categoryCounts: {},
      };
    }

    merchantMap[merchantName].totalAmount += tx.amount;
    merchantMap[merchantName].count += 1;
    merchantMap[merchantName].categoryCounts[cat] =
      (merchantMap[merchantName].categoryCounts[cat] || 0) + 1;
  }

  // Build aggregated items
  const items: VendorAggregationItem[] = Object.entries(merchantMap).map(
    ([merchantName, data]) => {
      const totalAmountGTQ = Number(data.totalAmount.toFixed(2));
      const transactionCount = data.count;
      const percentageShare =
        totalSpendGTQ > 0
          ? Number(((totalAmountGTQ / totalSpendGTQ) * 100).toFixed(1))
          : 0;
      const averageTicketGTQ =
        transactionCount > 0
          ? Number((totalAmountGTQ / transactionCount).toFixed(2))
          : 0;

      // Primary category is the most frequent category
      const primaryCategory = Object.entries(data.categoryCounts).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] || "Pendiente";

      return {
        merchantName,
        totalAmountGTQ,
        transactionCount,
        percentageShare,
        averageTicketGTQ,
        category: primaryCategory,
      };
    }
  );

  // Sort by Amount (descending) with tie-breaker on transaction count
  const byAmount = [...items]
    .sort((a, b) => {
      if (b.totalAmountGTQ !== a.totalAmountGTQ) {
        return b.totalAmountGTQ - a.totalAmountGTQ;
      }
      return b.transactionCount - a.transactionCount;
    })
    .slice(0, limit);

  // Sort by Frequency (descending) with tie-breaker on total amount
  const byFrequency = [...items]
    .sort((a, b) => {
      if (b.transactionCount !== a.transactionCount) {
        return b.transactionCount - a.transactionCount;
      }
      return b.totalAmountGTQ - a.totalAmountGTQ;
    })
    .slice(0, limit);

  return {
    totalSpendGTQ,
    totalTransactionsCount,
    byAmount,
    byFrequency,
  };
}
