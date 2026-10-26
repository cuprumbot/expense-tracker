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
    monthKey?: string | null;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
  }
): Transaction[] {
  const { category, searchTerm, currency, monthKey, dayOfWeek, dayOfMonth } = filters;
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

    if (monthKey) {
      if (extractMonthKey(tx.date) !== monthKey) return false;
    }

    if (typeof dayOfWeek === "number") {
      const parts = parseTransactionDateParts(tx.date);
      if (!parts) return false;
      const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
      const jsDay = d.getUTCDay();
      const dow = jsDay === 0 ? 6 : jsDay - 1; // 0=Lun ... 6=Dom
      if (dow !== dayOfWeek) return false;
    }

    if (typeof dayOfMonth === "number") {
      const parts = parseTransactionDateParts(tx.date);
      if (!parts || parts.day !== dayOfMonth) return false;
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

export interface TemporalPatternItem {
  key: string;
  label: string;
  shortLabel: string;
  totalAmountGTQ: number;
  transactionCount: number;
  percentage: number;
  isOutlier: boolean;
  anomalyScore?: number;
  outlierReason?: string;
}

export interface ConsumptionPatternInsight {
  type: "day_of_week" | "day_of_month";
  title: string;
  description: string;
  isAnomaly: boolean;
}

export interface ConsumptionPatternsResult {
  dayOfWeek: {
    items: TemporalPatternItem[];
    mean: number;
    stdDev: number;
    peakAmount: number;
  };
  dayOfMonth: {
    items: TemporalPatternItem[];
    mean: number;
    stdDev: number;
    peakAmount: number;
  };
  insights: ConsumptionPatternInsight[];
}

export const DAYS_OF_WEEK_DEF = [
  { key: "lun", label: "Lunes", shortLabel: "Lun" },
  { key: "mar", label: "Martes", shortLabel: "Mar" },
  { key: "mie", label: "Miércoles", shortLabel: "Mié" },
  { key: "jue", label: "Jueves", shortLabel: "Jue" },
  { key: "vie", label: "Viernes", shortLabel: "Vie" },
  { key: "sab", label: "Sábado", shortLabel: "Sáb" },
  { key: "dom", label: "Domingo", shortLabel: "Dom" },
];

const MONTH_NAME_TO_NUM: Record<string, number> = {
  ene: 1, jan: 1,
  feb: 2,
  mar: 3,
  abr: 4, apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8, aug: 8,
  sep: 9, set: 9,
  oct: 10,
  nov: 11,
  dic: 12, dec: 12,
};

export function parseTransactionDateParts(dateStr: string): {
  year: number;
  month: number;
  day: number;
} | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(/[-/.]/);
  if (parts.length < 3) return null;

  // YYYY-MM-DD
  if (parts[0].length === 4) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return { year, month, day };
    }
  }

  // DD-MM-YYYY
  if (parts[2].length === 4) {
    const year = parseInt(parts[2], 10);
    let month = parseInt(parts[1], 10);
    if (isNaN(month)) {
      const mStr = parts[1].toLowerCase().substring(0, 3);
      month = MONTH_NAME_TO_NUM[mStr] || 1;
    }
    const day = parseInt(parts[0], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return { year, month, day };
    }
  }

  return null;
}

/**
 * Calculates temporal consumption patterns (by day of week and day of month)
 * with mathematical statistical baseline and outlier anomaly detection.
 * Pure TypeScript logic operating 100% locally with zero external network calls.
 */
export function calculateConsumptionPatterns(
  transactions: Transaction[]
): ConsumptionPatternsResult {
  const validExpenses = transactions.filter(
    (tx) => typeof tx.amount === "number" && tx.amount > 0
  );

  const totalPeriodSpend = validExpenses.reduce((acc, tx) => acc + tx.amount, 0);

  // 1. Day of Week Aggregation (Index 0: Lunes ... 6: Domingo)
  const dowTotals = new Array(7).fill(0);
  const dowCounts = new Array(7).fill(0);

  // 2. Day of Month Aggregation (Index 0: Day 1 ... 30: Day 31)
  const domTotals = new Array(31).fill(0);
  const domCounts = new Array(31).fill(0);
  const domMonthMap: Record<number, Record<string, number>> = {};

  for (const tx of validExpenses) {
    const parts = parseTransactionDateParts(tx.date);
    if (!parts) continue;

    const { year, month, day } = parts;

    // Day of week (UTC date prevents timezone shifts)
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const jsDay = d.getUTCDay(); // 0 is Sun, 1 is Mon...
    const dowIndex = jsDay === 0 ? 6 : jsDay - 1; // 0=Lun ... 6=Dom

    if (dowIndex >= 0 && dowIndex < 7) {
      dowTotals[dowIndex] += tx.amount;
      dowCounts[dowIndex] += 1;
    }

    // Day of month (1 to 31)
    if (day >= 1 && day <= 31) {
      const domIndex = day - 1;
      domTotals[domIndex] += tx.amount;
      domCounts[domIndex] += 1;

      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      if (!domMonthMap[day]) domMonthMap[day] = {};
      domMonthMap[day][monthKey] = (domMonthMap[day][monthKey] || 0) + tx.amount;
    }
  }

  // Statistical Baseline for Day of Week (N = active days with non-zero expenses)
  const dowActiveDays = dowTotals.filter((amount) => amount > 0);
  const dowMean =
    dowActiveDays.length > 0
      ? Number((dowActiveDays.reduce((a, b) => a + b, 0) / dowActiveDays.length).toFixed(2))
      : 0;
  const dowVariance =
    dowActiveDays.length > 0
      ? dowActiveDays.reduce((acc, val) => acc + Math.pow(val - dowMean, 2), 0) / dowActiveDays.length
      : 0;
  const dowStdDev = Number(Math.sqrt(dowVariance).toFixed(2));
  const dowThreshold = dowMean + 1.75 * dowStdDev;

  // Sorted values for median calculation among active days
  const sortedDow = [...dowActiveDays].sort((a, b) => a - b);
  const dowMedian = sortedDow.length > 0 ? sortedDow[Math.floor(sortedDow.length / 2)] : 0;

  let dowPeak = 0;
  const dowItems: TemporalPatternItem[] = DAYS_OF_WEEK_DEF.map((def, idx) => {
    const amount = Number(dowTotals[idx].toFixed(2));
    if (amount > dowPeak) dowPeak = amount;
    const percentage =
      totalPeriodSpend > 0 ? Number(((amount / totalPeriodSpend) * 100).toFixed(1)) : 0;

    const isOutlier =
      amount > 0 &&
      dowStdDev > 0 &&
      (amount > dowThreshold || (dowMedian > 0 && amount > 2.5 * dowMedian));

    const anomalyScore =
      isOutlier && dowStdDev > 0
        ? Number(((amount - dowMean) / dowStdDev).toFixed(2))
        : undefined;

    return {
      key: def.key,
      label: def.label,
      shortLabel: def.shortLabel,
      totalAmountGTQ: amount,
      transactionCount: dowCounts[idx],
      percentage,
      isOutlier,
      anomalyScore,
      outlierReason: isOutlier
        ? `Gasto extraordinario de Q ${amount.toFixed(2)} (${anomalyScore}σ sobre la media semanal de Q ${dowMean.toFixed(2)})`
        : undefined,
    };
  });

  // Statistical Baseline for Day of Month (N = active days with non-zero expenses)
  const domActiveDays = domTotals.filter((amount) => amount > 0);
  const domMean =
    domActiveDays.length > 0
      ? Number((domActiveDays.reduce((a, b) => a + b, 0) / domActiveDays.length).toFixed(2))
      : 0;
  const domVariance =
    domActiveDays.length > 0
      ? domActiveDays.reduce((acc, val) => acc + Math.pow(val - domMean, 2), 0) / domActiveDays.length
      : 0;
  const domStdDev = Number(Math.sqrt(domVariance).toFixed(2));
  const domThreshold = domMean + 1.75 * domStdDev;

  let domPeak = 0;
  const domItems: TemporalPatternItem[] = Array.from({ length: 31 }, (_, idx) => {
    const dayNum = idx + 1;
    const amount = Number(domTotals[idx].toFixed(2));
    if (amount > domPeak) domPeak = amount;
    const percentage =
      totalPeriodSpend > 0 ? Number(((amount / totalPeriodSpend) * 100).toFixed(1)) : 0;

    // Cross-month anomaly detection (Rule 2 - disabled for now):
    // const monthsForThisDay = domMonthMap[dayNum] ? Object.values(domMonthMap[dayNum]) : [];
    // let hasCrossMonthSpike = false;
    // if (monthsForThisDay.length >= 2) {
    //   const maxMonthAmount = Math.max(...monthsForThisDay);
    //   const otherMonthAmounts = monthsForThisDay.filter((a) => a !== maxMonthAmount);
    //   const otherAvg =
    //     otherMonthAmounts.length > 0
    //       ? otherMonthAmounts.reduce((a, b) => a + b, 0) / otherMonthAmounts.length
    //       : 0;
    //   if (otherAvg > 0 && maxMonthAmount > 3.0 * otherAvg) {
    //     hasCrossMonthSpike = true;
    //   }
    // }

    const isOutlier =
      amount > 0 &&
      domStdDev > 0 &&
      amount > domThreshold;
      // Previously included Rule 2: || hasCrossMonthSpike
    const anomalyScore =
      isOutlier && domStdDev > 0
        ? Number(((amount - domMean) / domStdDev).toFixed(2))
        : undefined;

    return {
      key: String(dayNum),
      label: `Día ${dayNum}`,
      shortLabel: String(dayNum),
      totalAmountGTQ: amount,
      transactionCount: domCounts[idx],
      percentage,
      isOutlier,
      anomalyScore,
      outlierReason: isOutlier
        ? `Día atípico con gasto de Q ${amount.toFixed(2)} (promedio diario Q ${domMean.toFixed(2)})`
        : undefined,
    };
  });

  // Insights generation
  const insights: ConsumptionPatternInsight[] = [];

  const dowOutliers = dowItems.filter((i) => i.isOutlier);
  if (dowOutliers.length > 0) {
    const topDowOutlier = [...dowOutliers].sort(
      (a, b) => b.totalAmountGTQ - a.totalAmountGTQ
    )[0];
    insights.push({
      type: "day_of_week",
      title: "Consumo extraordinario en días específicos",
      description: `Se detectó un consumo extraordinario los días ${topDowOutlier.label.toLowerCase()} (acumulado Q ${topDowOutlier.totalAmountGTQ.toFixed(2)} frente al promedio semanal de Q ${dowMean.toFixed(2)}).`,
      isAnomaly: true,
    });
  } else {
    const topDow = [...dowItems].sort((a, b) => b.totalAmountGTQ - a.totalAmountGTQ)[0];
    insights.push({
      type: "day_of_week",
      title: "Distribución semanal balanceada",
      description: `El gasto semanal se mantiene regular, con mayor concentración habitual los días ${topDow?.label.toLowerCase() || "laborales"}.`,
      isAnomaly: false,
    });
  }

  const domOutliers = domItems.filter((i) => i.isOutlier);
  if (domOutliers.length > 0) {
    const topDomOutlier = [...domOutliers].sort(
      (a, b) => b.totalAmountGTQ - a.totalAmountGTQ
    )[0];
    insights.push({
      type: "day_of_month",
      title: "Día del mes con gasto inusual",
      description: `El ${topDomOutlier.label.toLowerCase()} concentró un gasto atípico de Q ${topDomOutlier.totalAmountGTQ.toFixed(2)}, destacando sobre el promedio diario de Q ${domMean.toFixed(2)}.`,
      isAnomaly: true,
    });
  }

  return {
    dayOfWeek: {
      items: dowItems,
      mean: dowMean,
      stdDev: dowStdDev,
      peakAmount: dowPeak,
    },
    dayOfMonth: {
      items: domItems,
      mean: domMean,
      stdDev: domStdDev,
      peakAmount: domPeak,
    },
    insights,
  };
}

export type TransactionAgeSegmentId =
  | "cuotas"
  | "suscripciones"
  | "inmediatas";

export interface TransactionAgeSegment {
  id: TransactionAgeSegmentId;
  label: string;
  shortDescription: string;
  color: string;
  totalAmountGTQ: number;
  transactionCount: number;
  percentageShare: number;
}

export interface TransactionAgeResult {
  segments: TransactionAgeSegment[];
  totalFilteredAmountGTQ: number;
  totalFilteredCount: number;
  selectedMonth: string;
  availableMonths: { monthKey: string; monthLabel: string }[];
}

export const TRANSACTION_AGE_COLORS: Record<TransactionAgeSegmentId, string> = {
  cuotas: "#2563eb",
  suscripciones: "#f59e0b",
  inmediatas: "#10b981",
};

/**
 * Categorizes spending into three canonical decision-age segments:
 * 1. Cuotas y Financiamiento: Decisions made in past months/years.
 * 2. Suscripciones y Servicios Recurrentes: Standing monthly commitments.
 * 3. Compras Inmediatas: Discretionary and fresh current-period expenses.
 *
 * Supports multi-month filtering ("all" or "YYYY-MM").
 * Pure local calculation conforming 100% to Split-Brain architecture.
 */
export function calculateTransactionAgeSegments(
  transactions: Transaction[],
  selectedMonth: string = "all"
): TransactionAgeResult {
  const validExpenses = transactions.filter(
    (tx) => typeof tx.amount === "number" && tx.amount > 0
  );

  // Discover all distinct months
  const monthKeySet = new Set<string>();
  for (const tx of validExpenses) {
    monthKeySet.add(extractMonthKey(tx.date));
  }
  const sortedMonthKeys = Array.from(monthKeySet).sort();
  const availableMonths = sortedMonthKeys.map((monthKey) => ({
    monthKey,
    monthLabel: formatMonthKeyToLabel(monthKey),
  }));

  // Filter by selected month if not "all"
  const filtered =
    selectedMonth && selectedMonth !== "all"
      ? validExpenses.filter((tx) => extractMonthKey(tx.date) === selectedMonth)
      : validExpenses;

  let cuotasTotal = 0;
  let cuotasCount = 0;

  let subsTotal = 0;
  let subsCount = 0;

  let inmediatasTotal = 0;
  let inmediatasCount = 0;

  for (const tx of filtered) {
    const cat = (tx.category || "").trim();
    const isCuota = cat.toLowerCase() === "visacuotas y financiamiento";
    const isSub =
      !isCuota &&
      (tx.isSubscription === true || cat.toLowerCase() === "suscripciones");

    if (isCuota) {
      cuotasTotal += tx.amount;
      cuotasCount += 1;
    } else if (isSub) {
      subsTotal += tx.amount;
      subsCount += 1;
    } else {
      inmediatasTotal += tx.amount;
      inmediatasCount += 1;
    }
  }

  const totalFilteredAmountGTQ = Number(
    (cuotasTotal + subsTotal + inmediatasTotal).toFixed(2)
  );
  const totalFilteredCount = filtered.length;

  const cuotasShare =
    totalFilteredAmountGTQ > 0
      ? Number(((cuotasTotal / totalFilteredAmountGTQ) * 100).toFixed(1))
      : 0;
  const subsShare =
    totalFilteredAmountGTQ > 0
      ? Number(((subsTotal / totalFilteredAmountGTQ) * 100).toFixed(1))
      : 0;
  const inmediatasShare =
    totalFilteredAmountGTQ > 0
      ? Number(Math.max(0, 100 - (cuotasShare + subsShare)).toFixed(1))
      : 0;

  const segments: TransactionAgeSegment[] = [
    {
      id: "cuotas",
      label: "Visacuotas y Financiamiento",
      shortDescription: "Decisiones de compra de meses o años pasados",
      color: TRANSACTION_AGE_COLORS.cuotas,
      totalAmountGTQ: Number(cuotasTotal.toFixed(2)),
      transactionCount: cuotasCount,
      percentageShare: cuotasShare,
    },
    {
      id: "suscripciones",
      label: "Suscripciones Recurrentes",
      shortDescription: "Servicios mensuales domiciliados y compromisos fijos",
      color: TRANSACTION_AGE_COLORS.suscripciones,
      totalAmountGTQ: Number(subsTotal.toFixed(2)),
      transactionCount: subsCount,
      percentageShare: subsShare,
    },
    {
      id: "inmediatas",
      label: "Compras Inmediatas",
      shortDescription: "Gastos discrecionales y consumos del período actual",
      color: TRANSACTION_AGE_COLORS.inmediatas,
      totalAmountGTQ: Number(inmediatasTotal.toFixed(2)),
      transactionCount: inmediatasCount,
      percentageShare: inmediatasShare,
    },
  ];

  return {
    segments,
    totalFilteredAmountGTQ,
    totalFilteredCount,
    selectedMonth,
    availableMonths,
  };
}

