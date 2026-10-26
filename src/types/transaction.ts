/**
 * Canonical Transaction interface used across all phases of the application.
 */
export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: "GTQ";
  classificationSource?: "local" | "llm" | "manual";
  category?: string | null;
  isSubscription?: boolean;
  originalCurrency?: "GTQ" | "USD";
  originalAmount?: number;
  exchangeRateApplied?: number;
}

export interface CustomCategory {
  id: string;
  name: string;
  color: string;
}

export interface CSVColumnMapping {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  currencyColumn?: string;
}

export interface CSVParsingSummary {
  totalRowsProcessed: number;
  validTransactionsCount: number;
  skippedRowsCount: number;
  totalAmount: number;
}

export interface CSVParsingResult {
  success: boolean;
  transactions: Transaction[];
  summary: CSVParsingSummary;
  headers: string[];
  rawRows: Record<string, string>[];
  needsMapping: boolean;
  detectedMapping?: Partial<CSVColumnMapping>;
  ambiguityReason?: string;
  error?: string;
}

export interface DrawerFilter {
  category?: string | null;
  monthKey?: string | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  displayLabel?: string | null;
}
