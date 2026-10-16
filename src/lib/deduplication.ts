import { Transaction } from "@/types/transaction";

/**
 * Normalizes a transaction description by:
 * - Converting to lower case
 * - Stripping accents and diacritics
 * - Removing punctuation and non-alphanumeric characters
 * - Normalizing inner whitespace
 */
export function normalizeDescription(description: string): string {
  if (!description) return "";
  return description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes a date to YYYY-MM-DD format.
 */
export function normalizeDate(date: string): string {
  if (!date) return "";
  return date.trim().split("T")[0];
}

/**
 * Normalizes an amount to a positive number rounded to 2 decimal places.
 */
export function normalizeAmount(amount: number): number {
  if (typeof amount !== "number" || Number.isNaN(amount)) return 0;
  return Number(Math.abs(amount).toFixed(2));
}

/**
 * Generates a unique deduplication fingerprint for a transaction.
 * A duplicate is identified when all three core fields match identically:
 * 1. Normalized Date (YYYY-MM-DD)
 * 2. Normalized Description (case-insensitive, punctuation-stripped)
 * 3. Normalized Amount (rounded to 2 decimal places)
 */
export function getTransactionSignature(tx: {
  date: string;
  description: string;
  amount: number;
}): string {
  const date = normalizeDate(tx.date);
  const desc = normalizeDescription(tx.description);
  const amt = normalizeAmount(tx.amount);
  return `${date}__${desc}__${amt}`;
}

export interface DeduplicationResult {
  uniqueTransactions: Transaction[];
  discardedCount: number;
  discardedTransactions: Transaction[];
  isAllDuplicates: boolean;
  notificationMessage: string | null;
}

/**
 * Identifies and automatically discards duplicate transactions.
 * Compares incoming transactions against:
 * 1. Existing transactions already in the active session
 * 2. Other transactions within the current incoming batch
 *
 * @param incoming - Newly ingested transactions
 * @param existing - Existing transactions currently in the session
 * @param sourceFileName - Optional name of the ingested file for notification copy
 */
export function deduplicateTransactions(
  incoming: Transaction[],
  existing: Transaction[] = [],
  sourceFileName?: string | null
): DeduplicationResult {
  if (!incoming || incoming.length === 0) {
    return {
      uniqueTransactions: [],
      discardedCount: 0,
      discardedTransactions: [],
      isAllDuplicates: false,
      notificationMessage: null,
    };
  }

  // Preload signatures from existing session transactions
  const seenSignatures = new Set<string>();
  for (const ex of existing) {
    seenSignatures.add(getTransactionSignature(ex));
  }

  const uniqueTransactions: Transaction[] = [];
  const discardedTransactions: Transaction[] = [];

  for (const item of incoming) {
    const signature = getTransactionSignature(item);
    if (seenSignatures.has(signature)) {
      discardedTransactions.push(item);
    } else {
      seenSignatures.add(signature);
      uniqueTransactions.push(item);
    }
  }

  const discardedCount = discardedTransactions.length;
  const isAllDuplicates = incoming.length > 0 && uniqueTransactions.length === 0;

  let notificationMessage: string | null = null;
  if (isAllDuplicates) {
    const fileName = sourceFileName || "cargado";
    notificationMessage = `Todas las transacciones del archivo '${fileName}' ya se encontraban registradas y fueron omitidas.`;
  } else if (discardedCount > 0) {
    const plural =
      discardedCount === 1 ? "transacción repetida" : "transacciones repetidas";
    notificationMessage = `Se detectaron y descartaron ${discardedCount} ${plural}. Es posible que hayas subido un estado de cuenta duplicado.`;
  }

  return {
    uniqueTransactions,
    discardedCount,
    discardedTransactions,
    isAllDuplicates,
    notificationMessage,
  };
}
