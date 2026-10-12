import defaultCatalog from "@/data/merchant-catalog.json";
import { Transaction } from "@/types/transaction";

export interface CategoryDefinition {
  id: string;
  name: string;
  description?: string;
  color?: string;
  keywords: string[];
}

export interface MerchantCatalog {
  categories: CategoryDefinition[];
  defaultCategory: string;
  unclassifiedThreshold?: number;
}

export const UNCLASSIFIED_THRESHOLD: number =
  (defaultCatalog as unknown as MerchantCatalog).unclassifiedThreshold ?? 5;

export const AVAILABLE_CATEGORIES: string[] =
  (defaultCatalog as unknown as MerchantCatalog).categories.map((c) => c.name);

/**
 * Normalizes text for case-insensitive, accent-insensitive, and punctuation-agnostic matching.
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s]/g, " ") // Replace special chars and punctuation with spaces
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Matches a transaction description against the configured merchant directory.
 * Handles merchant location variants (e.g., "La Torre Zona 10", "La Torre 14" -> "Supermercado").
 */
export function matchMerchantCategory(
  description: string,
  catalog: MerchantCatalog = defaultCatalog as MerchantCatalog
): {
  category: string;
  source: "local" | "unclassified";
  matchedKeyword?: string;
} {
  const normalizedDesc = normalizeText(description);

  if (!normalizedDesc) {
    return {
      category: catalog.defaultCategory || "Pendiente",
      source: "unclassified",
    };
  }

  let bestMatch: {
    categoryName: string;
    keyword: string;
    score: number;
  } | null = null;

  for (const cat of catalog.categories) {
    for (const kw of cat.keywords) {
      const normalizedKw = normalizeText(kw);
      if (!normalizedKw) continue;

      // Check substring presence with word boundaries or substring containment
      const regex = new RegExp(`(?:^|\\s)${normalizedKw}(?:\\s|$)`);
      const isWordMatch = regex.test(normalizedDesc);
      const isSubstring = normalizedDesc.includes(normalizedKw);

      if (isWordMatch || isSubstring) {
        const matchIndex = normalizedDesc.indexOf(normalizedKw);
        const isPrefix = matchIndex === 0;

        // Scoring:
        // - Base score on keyword length (specificity)
        // - High bonus for brand prefix (merchant name is almost always at the start)
        // - Bonus for whole-word matches
        // - Tiebreaker gives precedence to earlier words in the description
        let score = normalizedKw.length * 10;
        if (isPrefix) score += 50;
        if (isWordMatch) score += 20;
        score -= Math.min(matchIndex, 30);

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            categoryName: cat.name,
            keyword: kw,
            score,
          };
        }
      }
    }
  }

  if (bestMatch) {
    return {
      category: bestMatch.categoryName,
      source: "local",
      matchedKeyword: bestMatch.keyword,
    };
  }

  return {
    category: catalog.defaultCategory || "Pendiente",
    source: "unclassified",
  };
}

/**
 * Classifies a single transaction using the local merchant catalog.
 */
export function classifyTransaction(
  transaction: Transaction,
  catalog: MerchantCatalog = defaultCatalog as MerchantCatalog
): Transaction {
  const match = matchMerchantCategory(transaction.description, catalog);
  const isSubscription =
    match.category.toLowerCase() === "suscripciones" ||
    Boolean(transaction.isSubscription);

  return {
    ...transaction,
    category: match.category,
    classificationSource: match.source === "local" ? "local" : undefined,
    isSubscription: isSubscription ? true : undefined,
  };
}

/**
 * Classifies an array of transactions using the local merchant catalog.
 */
export function classifyTransactions(
  transactions: Transaction[],
  catalog: MerchantCatalog = defaultCatalog as MerchantCatalog
): Transaction[] {
  return transactions.map((tx) => classifyTransaction(tx, catalog));
}

export interface ClassificationStats {
  total: number;
  classifiedCount: number;
  pendingCount: number;
  categoryBreakdown: Record<
    string,
    {
      count: number;
      totalAmount: number;
      color?: string;
    }
  >;
}

/**
 * Computes aggregation stats across categorized transactions.
 */
export function getClassificationStats(
  transactions: Transaction[],
  catalog: MerchantCatalog = defaultCatalog as MerchantCatalog
): ClassificationStats {
  const stats: ClassificationStats = {
    total: transactions.length,
    classifiedCount: 0,
    pendingCount: 0,
    categoryBreakdown: {},
  };

  const defaultCategory = catalog.defaultCategory || "Pendiente";

  for (const tx of transactions) {
    const category = tx.category || defaultCategory;
    const isPending = category === defaultCategory;

    if (isPending) {
      stats.pendingCount++;
    } else {
      stats.classifiedCount++;
    }

    if (!stats.categoryBreakdown[category]) {
      const catDef = catalog.categories.find((c) => c.name === category);
      stats.categoryBreakdown[category] = {
        count: 0,
        totalAmount: 0,
        color: catDef?.color || "zinc",
      };
    }

    stats.categoryBreakdown[category].count++;
    stats.categoryBreakdown[category].totalAmount += tx.amount;
  }

  return stats;
}

export interface SubscriptionSummary {
  transactions: Transaction[];
  count: number;
  totalMonthlyCommitment: number;
  services: {
    id: string;
    name: string;
    amount: number;
    date: string;
  }[];
}

/**
 * Calculates recurring subscriptions and total monthly financial commitment.
 * Operates purely locally with zero external LLM invocations.
 */
export function getSubscriptionSummary(
  transactions: Transaction[]
): SubscriptionSummary {
  const subscriptions = transactions.filter(
    (tx) =>
      tx.isSubscription === true ||
      (tx.isSubscription !== false && tx.category === "Suscripciones")
  );

  const totalMonthlyCommitment = subscriptions.reduce(
    (acc, tx) => acc + (tx.amount || 0),
    0
  );

  const services = subscriptions.map((tx) => ({
    id: tx.id,
    name: tx.description,
    amount: tx.amount,
    date: tx.date,
  }));

  return {
    transactions: subscriptions,
    count: subscriptions.length,
    totalMonthlyCommitment: Math.round(totalMonthlyCommitment * 100) / 100,
    services,
  };
}
