"use client";

import React, { useState, useMemo } from "react";
import {
  Transaction,
  CSVParsingSummary,
  CustomCategory,
} from "@/types/transaction";
import { formatCurrency } from "@/lib/currency";
import {
  getSubscriptionSummary,
  UNCLASSIFIED_THRESHOLD,
  AVAILABLE_CATEGORIES,
} from "@/lib/expense-classifier";
import {
  calculateReportingMetrics,
  filterTransactions,
} from "@/lib/reporting";
import { Icons } from "@/components/icons";
import { CustomCategoryModal } from "@/components/custom-category-modal";
import { ExpenseDashboard } from "@/components/expense-dashboard";
import { SavingsRecommendationResponse } from "@/lib/savings-advisor";

interface TransactionTableProps {
  transactions: Transaction[];
  summary: CSVParsingSummary;
  sourceLabel?: string;
  customCategories?: CustomCategory[];
  savingsRecommendations?: SavingsRecommendationResponse | null;
  onSavingsRecommendationsChange?: (
    recommendations: SavingsRecommendationResponse | null
  ) => void;
  onReset: () => void;
  onUpdateCategory?: (
    transactionId: string,
    newCategory: string,
    applyToAllWithSameDescription?: boolean,
    targetDescription?: string
  ) => void;
  onAddCustomCategory?: (category: CustomCategory) => void;
  onEditTransaction?: (transaction: Transaction) => void;
  onDeleteTransaction?: (transactionId: string) => void;
  onBulkAssignCategory?: (transactionIds: string[], newCategory: string) => void;
  onBulkDeleteTransactions?: (transactionIds: string[]) => void;
  onToggleSubscription?: (transactionId: string) => void;
  onClearData?: () => void;
  onClassifyPendingWithLLM?: () => void;
  isClassifyingWithLLM?: boolean;
  llmClassificationError?: string | null;
  llmSuccessMessage?: string | null;
  unclassifiedThreshold?: number;
  duplicateNotification?: string | null;
  onDismissDuplicateNotification?: () => void;
  onAddMoreStatements?: () => void;
  batchSummaryNotification?: string | null;
  onDismissBatchSummaryNotification?: () => void;
  batchErrors?: { fileName: string; error: string }[];
  onDismissBatchError?: (fileName: string) => void;
}

type SortField = "date" | "description" | "amount";
type SortDirection = "asc" | "desc";

function parseDateForSort(dateStr: string): number {
  if (!dateStr) return 0;
  const trimmed = dateStr.trim();
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
  }
  const timestamp = Date.parse(trimmed);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

const CATEGORY_STYLES: Record<
  string,
  {
    bg: string;
    text: string;
    border: string;
    dot: string;
  }
> = {
  Supermercado: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  "Restaurantes y Cafés": {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  "Servicios Básicos": {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
  },
  "Transporte y Combustible": {
    bg: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
    dot: "bg-orange-500",
  },
  "Salud y Farmacia": {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-800",
    dot: "bg-teal-500",
  },
  "Entretenimiento y Compras": {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-800",
    dot: "bg-violet-500",
  },
  Suscripciones: {
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800",
    dot: "bg-indigo-500",
  },
  Pendiente: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-200 font-medium",
    border: "border-amber-300 dark:border-amber-700",
    dot: "bg-amber-500",
  },
};

const DEFAULT_STYLE = {
  bg: "bg-zinc-100 dark:bg-zinc-800/70",
  text: "text-zinc-600 dark:text-zinc-400",
  border: "border-zinc-200 dark:border-zinc-700",
  dot: "bg-zinc-400",
};

export function TransactionTable({
  transactions,
  summary,
  sourceLabel = "Archivo de movimientos",
  customCategories = [],
  onReset,
  onUpdateCategory,
  onAddCustomCategory,
  onEditTransaction,
  onDeleteTransaction,
  onBulkAssignCategory,
  onBulkDeleteTransactions,
  onToggleSubscription,
  savingsRecommendations = null,
  onSavingsRecommendationsChange,
  onClearData,
  onClassifyPendingWithLLM,
  isClassifyingWithLLM = false,
  llmClassificationError = null,
  llmSuccessMessage = null,
  unclassifiedThreshold = UNCLASSIFIED_THRESHOLD,
  duplicateNotification = null,
  onDismissDuplicateNotification,
  onAddMoreStatements,
  batchSummaryNotification = null,
  onDismissBatchSummaryNotification,
  batchErrors = [],
  onDismissBatchError,
}: TransactionTableProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCurrency, setSelectedCurrency] = useState<"all" | "GTQ" | "USD">("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTargetCategory, setBulkTargetCategory] = useState<string>("");
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    date: string;
    description: string;
    amount: string;
    category: string;
    isSubscription?: boolean;
  }>({
    date: "",
    description: "",
    amount: "",
    category: "Pendiente",
    isSubscription: false,
  });
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  const [batchCategoryPrompt, setBatchCategoryPrompt] = useState<{
    transaction: Transaction;
    newCategory: string;
    matchingTransactions: Transaction[];
  } | null>(null);

  // Financial reporting metrics (US-012)
  const reportingMetrics = useMemo(() => {
    return calculateReportingMetrics(transactions);
  }, [transactions]);

  // Compatibility stats for triage
  const stats = useMemo(() => {
    const categoryTotals: Record<string, { count: number; total: number }> = {};
    for (const cat of reportingMetrics.categories) {
      categoryTotals[cat.category] = { count: cat.count, total: cat.total };
    }
    return {
      classified: reportingMetrics.classifiedCount,
      pending: reportingMetrics.pendingCount,
      categoryTotals,
    };
  }, [reportingMetrics]);

  // Unique categories from reporting metrics
  const uniqueCategories = useMemo(() => {
    return reportingMetrics.categories.map((c) => c.category);
  }, [reportingMetrics.categories]);

  // All available categories list for selects
  const availableCategoriesList = useMemo(() => {
    const set = new Set([
      ...AVAILABLE_CATEGORIES,
      ...customCategories.map((c) => c.name),
      ...uniqueCategories.filter((c) => c !== "Pendiente"),
    ]);
    return Array.from(set);
  }, [customCategories, uniqueCategories]);

  // Filtered transactions by category, search term, and currency (US-012, US-023)
  const filteredTransactions = useMemo(() => {
    return filterTransactions(transactions, {
      category: selectedCategory,
      searchTerm,
      currency: selectedCurrency,
    });
  }, [transactions, selectedCategory, searchTerm, selectedCurrency]);

  // Sorted transactions
  const sortedTransactions = useMemo(() => {
    if (!sortField) return filteredTransactions;

    const list = [...filteredTransactions];
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === "description") {
        comparison = a.description.localeCompare(b.description, "es", {
          sensitivity: "base",
        });
      } else if (sortField === "date") {
        const timeA = parseDateForSort(a.date);
        const timeB = parseDateForSort(b.date);
        comparison = timeA - timeB;
        if (comparison === 0) {
          comparison = a.date.localeCompare(b.date);
        }
      } else if (sortField === "amount") {
        comparison = a.amount - b.amount;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return list;
  }, [filteredTransactions, sortField, sortDirection]);

  const filteredTotal = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => acc + tx.amount, 0);
  }, [filteredTransactions]);

  const subscriptionSummary = useMemo(() => {
    return getSubscriptionSummary(transactions);
  }, [transactions]);

  // Helper for dynamic category style
  const getCategoryBadgeStyle = (categoryName: string) => {
    if (CATEGORY_STYLES[categoryName]) {
      return {
        styleClass: CATEGORY_STYLES[categoryName],
        inlineStyle: undefined as React.CSSProperties | undefined,
        inlineDotStyle: undefined as React.CSSProperties | undefined,
      };
    }
    const custom = customCategories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase()
    );
    if (custom) {
      return {
        styleClass: {
          bg: "",
          text: "",
          border: "border",
          dot: "",
        },
        inlineStyle: {
          backgroundColor: `${custom.color}15`,
          color: custom.color,
          borderColor: `${custom.color}40`,
        },
        inlineDotStyle: {
          backgroundColor: custom.color,
        },
      };
    }
    return {
      styleClass: DEFAULT_STYLE,
      inlineStyle: undefined,
      inlineDotStyle: undefined,
    };
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleCategorySelection = (tx: Transaction, targetCategory: string) => {
    if (targetCategory === "__create_new__") {
      setIsNewCategoryModalOpen(true);
      return;
    }

    const currentCategory = tx.category || "Pendiente";
    if (targetCategory === currentCategory) return;
    if (!onUpdateCategory) return;

    // Check if other transactions have the exact same name
    const normalizedName = tx.description.trim().toLowerCase();
    const otherMatching = transactions.filter(
      (t) =>
        t.id !== tx.id && t.description.trim().toLowerCase() === normalizedName
    );

    if (otherMatching.length > 0) {
      setBatchCategoryPrompt({
        transaction: tx,
        newCategory: targetCategory,
        matchingTransactions: otherMatching,
      });
    } else {
      onUpdateCategory(tx.id, targetCategory, false);
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return (
        <Icons.ArrowUpDown className="w-3 h-3 text-zinc-400 opacity-60 shrink-0" />
      );
    }
    return sortDirection === "asc" ? (
      <Icons.ArrowUp className="w-3 h-3 text-zinc-900 dark:text-zinc-100 shrink-0" />
    ) : (
      <Icons.ArrowDown className="w-3 h-3 text-zinc-900 dark:text-zinc-100 shrink-0" />
    );
  };

  // Selection handlers
  const allFilteredSelected =
    sortedTransactions.length > 0 &&
    sortedTransactions.every((tx) => selectedIds.has(tx.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        sortedTransactions.forEach((tx) => next.delete(tx.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        sortedTransactions.forEach((tx) => next.add(tx.id));
        return next;
      });
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleApplyBulkCategory = () => {
    if (!bulkTargetCategory || selectedIds.size === 0) return;
    onBulkAssignCategory?.(Array.from(selectedIds), bulkTargetCategory);
    setSelectedIds(new Set());
    setBulkTargetCategory("");
  };

  const handleApplyBulkDelete = () => {
    if (selectedIds.size === 0) return;
    onBulkDeleteTransactions?.(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  // Inline edit handlers
  const startEditing = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setEditForm({
      date: tx.date,
      description: tx.description,
      amount: tx.amount.toString(),
      category: tx.category || "Pendiente",
      isSubscription:
        tx.isSubscription === true ||
        (tx.isSubscription !== false && tx.category === "Suscripciones"),
    });
  };

  const handleSaveEdit = (tx: Transaction) => {
    const amt = parseFloat(editForm.amount);
    if (isNaN(amt) || amt <= 0 || !editForm.description.trim()) {
      return;
    }
    const isSub =
      editForm.isSubscription !== undefined
        ? editForm.isSubscription
        : editForm.category.toLowerCase() === "suscripciones" ||
        (tx.isSubscription && editForm.category !== "Pendiente");

    onEditTransaction?.({
      ...tx,
      date: editForm.date.trim() || tx.date,
      description: editForm.description.trim(),
      amount: Number(amt.toFixed(2)),
      category: editForm.category,
      classificationSource: "manual",
      isSubscription: isSub ? true : false,
    });
    setEditingTxId(null);
  };

  const cancelEditing = () => {
    setEditingTxId(null);
  };

  return (
    <div className="space-y-6">
      {/* Batch Ingestion Outcome Summary (US-026) */}
      {batchSummaryNotification && (
        <div
          role="status"
          id="batch-summary-banner"
          className="p-4 rounded-xl border border-emerald-300 bg-emerald-50 dark:border-emerald-800/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 flex items-start justify-between gap-3 shadow-xs animate-in fade-in duration-200"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
              <Icons.CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                Lote de archivos procesado
              </h4>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
                {batchSummaryNotification}
              </p>
            </div>
          </div>
          {onDismissBatchSummaryNotification && (
            <button
              type="button"
              onClick={onDismissBatchSummaryNotification}
              aria-label="Cerrar notificación de lote"
              className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 cursor-pointer p-1 rounded-md hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 transition-colors shrink-0"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Batch Ingestion Errors (US-026) */}
      {batchErrors && batchErrors.length > 0 && (
        <div className="space-y-2">
          {batchErrors.map((err) => (
            <div
              key={`batch-err-${err.fileName}`}
              role="alert"
              className="p-4 rounded-xl border border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 text-red-900 dark:text-red-200 flex items-start justify-between gap-3 shadow-xs animate-in fade-in duration-200"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Icons.AlertCircle className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-red-900 dark:text-red-200">
                    Error al procesar {err.fileName}
                  </h4>
                  <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed font-medium">
                    {err.error}
                  </p>
                </div>
              </div>
              {onDismissBatchError && (
                <button
                  type="button"
                  onClick={() => onDismissBatchError(err.fileName)}
                  aria-label={`Cerrar error de ${err.fileName}`}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 cursor-pointer p-1 rounded-md hover:bg-red-100/60 dark:hover:bg-red-900/40 transition-colors shrink-0"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Prominent Duplicate Detection Alert Banner (US-028) */}
      {duplicateNotification && (
        <div
          role="alert"
          id="duplicate-transactions-banner"
          className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3 shadow-xs animate-in fade-in duration-200"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <Icons.AlertCircle className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                Aviso de transacciones duplicadas
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                {duplicateNotification}
              </p>
            </div>
          </div>
          {onDismissDuplicateNotification && (
            <button
              type="button"
              onClick={onDismissDuplicateNotification}
              aria-label="Cerrar notificación"
              className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 cursor-pointer p-1 rounded-md hover:bg-amber-100/60 dark:hover:bg-amber-900/40 transition-colors shrink-0"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Top Section: Aggregated Dashboard (when fully classified) or Triage Cards (when pending) */}
      {stats.pending === 0 ? (
        <ExpenseDashboard
          metrics={reportingMetrics}
          subscriptionSummary={subscriptionSummary}
          customCategories={customCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
          onToggleSubscription={onToggleSubscription}
          savingsRecommendations={savingsRecommendations}
          onSavingsRecommendationsChange={onSavingsRecommendationsChange}
          onAddMoreStatements={onAddMoreStatements}
        />
      ) : (
        <div className="space-y-4">
          {/* Summary Triage KPI Cards (US-009 & US-012) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-2xs">
              <p className="text-2xs font-medium text-zinc-500 uppercase tracking-wider">
                Total de gastos
              </p>
              <p className="text-xl font-semibold font-mono text-zinc-900 dark:text-zinc-100 mt-1 whitespace-nowrap">
                {formatCurrency(summary.totalAmount)}
              </p>
              <p className="text-2xs text-zinc-400 mt-1">
                {transactions.length} transacciones
              </p>
            </div>

            <div className="p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 shadow-2xs">
              <p className="text-2xs font-medium text-zinc-500 uppercase tracking-wider">
                Gastos clasificados
              </p>
              <p className="text-xl font-semibold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {stats.classified} de {transactions.length}
              </p>
              <p className="text-2xs text-zinc-400 mt-1">
                {Math.round((stats.classified / (transactions.length || 1)) * 100)}% categorizados
              </p>
            </div>

            {/* Single Unified Alert & Filter Card for Unclassified Expenses */}
            <div
              role="button"
              tabIndex={0}
              onClick={() =>
                setSelectedCategory(selectedCategory === "Pendiente" ? "all" : "Pendiente")
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedCategory(selectedCategory === "Pendiente" ? "all" : "Pendiente");
                }
              }}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer text-left flex flex-col justify-between ${selectedCategory === "Pendiente"
                ? "border-amber-500 bg-amber-100/70 dark:border-amber-500 dark:bg-amber-950/60 ring-2 ring-amber-400/60 shadow-xs"
                : "border-amber-400/90 bg-amber-50/50 hover:bg-amber-100/50 hover:border-amber-500 dark:border-amber-600 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 shadow-2xs"
                }`}
              title={
                selectedCategory === "Pendiente"
                  ? "Haga clic para mostrar todos los gastos"
                  : "Haga clic para filtrar y ver solo gastos pendientes"
              }
            >
              <div>
                <div>
                  <p className="text-2xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                    Gastos pendientes de clasificar
                  </p>
                </div>

                <p className="text-xl font-bold font-mono text-amber-900 dark:text-amber-100 mt-1">
                  {stats.pending}
                </p>

                <p className="text-2xs text-amber-800/90 dark:text-amber-300/90 mt-1 leading-snug">
                  {stats.pending > unclassifiedThreshold
                    ? `Tienes ${stats.pending} gastos pendientes de clasificar, espera mientras la IA los clasifica...`
                    : stats.pending > 0
                    ? `Tienes ${stats.pending} ${stats.pending === 1 ? "gasto pendiente" : "gastos pendientes"} de clasificar. Haz clic aquí para filtrarlos y asignarlos rápidamente.`
                    : "Todos tus gastos están clasificados."}
                </p>
              </div>

              {/* If > threshold pending, show the AI Classification button inside the card */}
              {stats.pending > unclassifiedThreshold && onClassifyPendingWithLLM && (
                <div className="mt-3 pt-2.5 border-t border-amber-200/80 dark:border-amber-900/60">
                  <button
                    type="button"
                    disabled={isClassifyingWithLLM}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClassifyPendingWithLLM();
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-lg dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-xs cursor-pointer"
                  >
                    {isClassifyingWithLLM ? (
                      <>
                        <Icons.RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Clasificando con IA...</span>
                      </>
                    ) : (
                      <>
                        <Icons.Sparkles className="w-3.5 h-3.5" />
                        <span>Clasificar con IA (Gemini Pro)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* AI Classification Error Message (if any) */}
          {llmClassificationError && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200 flex items-start gap-2">
              <Icons.AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold">No se pudo completar la clasificación con IA</p>
                <p className="text-2xs">{llmClassificationError}</p>
                <p className="text-2xs text-red-700 dark:text-red-300">
                  Puedes clasificar los gastos manualmente con los menús desplegables de la tabla.
                </p>
              </div>
            </div>
          )}

          {/* Subscriptions Audit Banner Preview (US-008) */}
          {subscriptionSummary.count > 0 && (
            <div className="p-4 rounded-xl border border-indigo-200/90 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center dark:bg-indigo-900/70 dark:text-indigo-300">
                    <Icons.CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-2xs font-semibold tracking-wider text-indigo-900/70 dark:text-indigo-300/80 uppercase">
                      Gastos recurrentes
                    </span>
                    <span className="ml-2 text-2xs font-mono px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                      {subscriptionSummary.count} {subscriptionSummary.count === 1 ? "servicio" : "servicios"}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-2xs text-indigo-700/80 dark:text-indigo-300/80 block">
                    Compromiso mensual estimado:
                  </span>
                  <span className="text-sm font-semibold font-mono text-indigo-950 dark:text-indigo-100 whitespace-nowrap">
                    {formatCurrency(subscriptionSummary.totalMonthlyCommitment)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-indigo-200/60 dark:border-indigo-900/40">
                {subscriptionSummary.services.map((sub) => (
                  <div
                    key={`sub-triage-${sub.id}-${sub.name}`}
                    className="p-3.5 rounded-xl border border-indigo-200/70 bg-white dark:border-indigo-900/40 dark:bg-zinc-900/90 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block truncate" title={sub.name}>
                        {sub.name}
                      </span>
                      <div className="flex items-center gap-2 text-2xs text-zinc-500 font-mono">
                        <span>{sub.date}</span>
                        <span>·</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                          {formatCurrency(sub.amount).replace(" ", "\u00A0")}
                        </span>
                      </div>
                    </div>

                    {onToggleSubscription && (
                      <button
                        type="button"
                        onClick={() => onToggleSubscription(sub.id)}
                        className="text-2xs font-medium px-2.5 py-1 rounded-md text-zinc-600 hover:text-red-600 bg-zinc-100 hover:bg-red-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-red-950/40 dark:hover:text-red-300 transition-colors shrink-0 cursor-pointer whitespace-nowrap"
                        title="Desmarcar esta transacción como suscripción recurrente"
                      >
                        Desmarcar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success Notification */}
      {llmSuccessMessage && (
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <Icons.CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{llmSuccessMessage}</span>
          </div>
          <span className="text-3xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            Completado
          </span>
        </div>
      )}

      {/* Category Pills & Search Filter Bar (US-012) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input Box */}
          <div className="relative flex-1 max-w-md">
            <Icons.Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por descripción, comercio..."
              aria-label="Buscar transacciones"
              className="w-full pl-8.5 pr-8 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white placeholder-zinc-400 text-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:ring-zinc-100"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-0.5"
                title="Limpiar búsqueda"
              >
                <Icons.X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Quick Actions & Clear Filter */}
          <div className="flex items-center gap-3 self-end sm:self-auto text-xs text-zinc-500">
            {(selectedCategory !== "all" || searchTerm || selectedCurrency !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("all");
                  setSearchTerm("");
                  setSelectedCurrency("all");
                }}
                className="text-2xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline cursor-pointer"
              >
                Limpiar filtros ({filteredTransactions.length} de {transactions.length})
              </button>
            )}
            {onAddCustomCategory && (
              <button
                type="button"
                onClick={() => setIsNewCategoryModalOpen(true)}
                className="inline-flex items-center gap-1 text-2xs font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 underline cursor-pointer"
              >
                <Icons.Plus className="w-3 h-3" />
                <span>Nueva categoría</span>
              </button>
            )}
          </div>
        </div>

        {/* Currency Filter Bar (US-023) */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span className="text-2xs font-medium text-zinc-500 dark:text-zinc-400 mr-1">
            Moneda:
          </span>
          <div
            role="group"
            aria-label="Filtrar por moneda"
            className="inline-flex p-0.5 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 text-xs"
          >
            <button
              type="button"
              onClick={() => setSelectedCurrency("all")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                selectedCurrency === "all"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setSelectedCurrency("GTQ")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                selectedCurrency === "GTQ"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Solo Quetzales (GTQ)
            </button>
            <button
              type="button"
              onClick={() => setSelectedCurrency("USD")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                selectedCurrency === "USD"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              <Icons.Globe className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Solo Dólares (USD)</span>
            </button>
          </div>
        </div>

        {/* Category Pills Filter */}
        {uniqueCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-2xs font-medium text-zinc-400 mr-1 hidden sm:inline">
              Categorías:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${selectedCategory === "all"
                ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-800"
                }`}
            >
              <span>Todos</span>
              <span className="text-2xs opacity-75">({transactions.length})</span>
            </button>

            {uniqueCategories.map((cat) => {
              const info = stats.categoryTotals[cat] || { count: 0, total: 0 };
              const { styleClass, inlineStyle, inlineDotStyle } = getCategoryBadgeStyle(cat);
              const isSelected = selectedCategory === cat;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? "all" : cat)}
                  style={isSelected && inlineStyle ? inlineStyle : undefined}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${isSelected
                    ? `${styleClass.bg} ${styleClass.text} ${styleClass.border} ring-1 ring-current`
                    : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-800"
                    }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${styleClass.dot}`}
                    style={inlineDotStyle}
                  />
                  <span>{cat}</span>
                  <span className="text-2xs opacity-75">({info.count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk Actions Floating/Sticky Bar */}
      {selectedIds.size > 0 && (
        <div className="p-3 bg-zinc-900 text-white dark:bg-zinc-900 dark:text-zinc-100 border border-zinc-800 dark:border-zinc-700/80 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold">
              {selectedIds.size}{" "}
              {selectedIds.size === 1
                ? "transacción seleccionada"
                : "transacciones seleccionadas"}
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-2xs underline opacity-75 hover:opacity-100 cursor-pointer"
            >
              Deseleccionar todas
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="bulk-cat-select"
              className="text-xs font-medium opacity-90 hidden sm:inline"
            >
              Asignar categoría:
            </label>
            <select
              id="bulk-cat-select"
              value={bulkTargetCategory}
              onChange={(e) => {
                if (e.target.value === "__create_new__") {
                  setIsNewCategoryModalOpen(true);
                } else {
                  setBulkTargetCategory(e.target.value);
                }
              }}
              className="px-2.5 py-1 text-xs rounded-lg bg-zinc-800 text-white border border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
            >
              <option value="">Seleccionar categoría...</option>
              {availableCategoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="__create_new__">+ Nueva categoría...</option>
            </select>
            <button
              type="button"
              disabled={!bulkTargetCategory}
              onClick={handleApplyBulkCategory}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-zinc-900 bg-white hover:bg-zinc-100 disabled:opacity-50 rounded-lg dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors cursor-pointer shadow-xs"
            >
              <Icons.Check className="w-3.5 h-3.5" />
              <span>Guardar</span>
            </button>
            {onBulkDeleteTransactions && (
              <button
                type="button"
                onClick={handleApplyBulkDelete}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-300 hover:text-red-100 bg-red-950/60 hover:bg-red-900/80 rounded-lg dark:text-red-300 dark:bg-red-950/60 dark:hover:bg-red-900/80 transition-colors cursor-pointer border border-red-800/40"
                title="Eliminar transacciones seleccionadas"
              >
                <Icons.Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="border border-zinc-200 rounded-xl bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Movimientos extraídos
            </span>
            <span className="text-2xs font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {sourceLabel}
            </span>
            {selectedCategory !== "all" && (
              <span className="text-2xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-medium dark:bg-zinc-800 dark:text-zinc-300">
                Subtotal: {formatCurrency(filteredTotal)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onAddMoreStatements && (
              <button
                type="button"
                id="btn-agregar-estados-cuenta"
                onClick={onAddMoreStatements}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-800 dark:hover:bg-emerald-900/60 rounded-lg transition-colors cursor-pointer shadow-2xs"
                title="Añadir más archivos de estado de cuenta a esta sesión"
              >
                <Icons.Plus className="w-3.5 h-3.5" />
                <span>Agregar más estados de cuenta</span>
              </button>
            )}
            {onAddCustomCategory && (
              <button
                type="button"
                onClick={() => setIsNewCategoryModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:text-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
              >
                <Icons.Plus className="w-3.5 h-3.5" />
                <span>Nueva categoría</span>
              </button>
            )}
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:text-zinc-400 dark:border-zinc-700 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <Icons.RefreshCw className="w-3.5 h-3.5" />
              <span>Cargar otro archivo</span>
            </button>
            {onClearData && (
              <button
                type="button"
                onClick={onClearData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                title="Borrar todos los datos guardados en el navegador"
              >
                <Icons.Trash2 className="w-3.5 h-3.5" />
                <span>Borrar mis datos</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[550px]">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-zinc-50 sticky top-0 border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 z-10 select-none">
              <tr>
                <th className="w-10 px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleToggleSelectAll}
                    aria-label="Seleccionar todas las transacciones filtradas"
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-2.5 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort("date")}
                    className="inline-flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer font-medium"
                    title="Ordenar por fecha"
                  >
                    <span>Fecha</span>
                    {renderSortIndicator("date")}
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort("description")}
                    className="inline-flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer font-medium"
                    title="Ordenar por descripción"
                  >
                    <span>Descripción</span>
                    {renderSortIndicator("description")}
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium">Categoría</th>
                <th className="px-3 py-2.5 font-medium text-center">Suscripción</th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    type="button"
                    onClick={() => handleSort("amount")}
                    className="inline-flex items-center gap-1.5 justify-end ml-auto hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer font-medium"
                    title="Ordenar por monto"
                  >
                    <span>Monto (GTQ)</span>
                    {renderSortIndicator("amount")}
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium text-center w-28">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sortedTransactions.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-xs text-zinc-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Icons.Search className="w-5 h-5 text-zinc-400" />
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        No se encontraron transacciones
                      </span>
                      <span className="text-2xs text-zinc-400">
                        Intenta ajustar los filtros de categoría o el término de búsqueda.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
              {sortedTransactions.map((tx, index) => {
                const category = tx.category || "Pendiente";
                const isPending = category === "Pendiente";
                const { styleClass, inlineStyle, inlineDotStyle } = getCategoryBadgeStyle(category);
                const isEditing = editingTxId === tx.id;
                const isDeleting = deletingTxId === tx.id;
                const isSelected = selectedIds.has(tx.id);

                if (isEditing) {
                  return (
                    <tr
                      key={`${tx.id}-${index}`}
                      className="bg-amber-50/40 dark:bg-amber-950/20 transition-colors"
                    >
                      <td className="w-10 px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          disabled
                          className="opacity-40 rounded"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editForm.date}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, date: e.target.value }))
                          }
                          className="w-24 px-2 py-1 text-2xs font-mono border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              description: e.target.value,
                            }))
                          }
                          className="w-full px-2 py-1 text-xs border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={editForm.category}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              category: e.target.value,
                            }))
                          }
                          className="text-2xs font-medium px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                        >
                          <option value="Pendiente">Pendiente</option>
                          {availableCategoriesList.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setEditForm((prev) => ({
                              ...prev,
                              isSubscription: !prev.isSubscription,
                            }))
                          }
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border cursor-pointer ${editForm.isSubscription
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
                            : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                            }`}
                        >
                          <Icons.CreditCard className="w-3 h-3" />
                          <span>
                            {editForm.isSubscription ? "Recurrente" : "No recurrente"}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {tx.originalCurrency === "USD" && (
                            <span
                              className="px-1.5 py-0.5 rounded text-3xs font-sans font-semibold tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"
                              title={`Original: $${(tx.originalAmount ?? 0).toFixed(2)} USD`}
                            >
                              USD
                            </span>
                          )}
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={editForm.amount}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                amount: e.target.value,
                              }))
                            }
                            className="w-24 px-2 py-1 text-xs font-mono text-right border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(tx)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-3xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors shadow-2xs cursor-pointer"
                            title="Guardar cambios"
                          >
                            <Icons.Check className="w-3 h-3" />
                            <span>Guardar</span>
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded transition-colors cursor-pointer"
                            title="Cancelar edición"
                          >
                            <Icons.X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={`${tx.id}-${index}`}
                    className={`transition-colors ${isSelected
                      ? "bg-zinc-100/70 dark:bg-zinc-800/40"
                      : isPending
                        ? "bg-amber-50/25 dark:bg-amber-950/10 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                        : "hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60"
                      }`}
                  >
                    <td className="w-10 px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(tx.id)}
                        aria-label={`Seleccionar transacción ${tx.description}`}
                        className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-500 font-mono text-2xs">
                      {tx.date}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-900 dark:text-zinc-100 font-medium">
                      <span>{tx.description}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {onUpdateCategory ? (
                        <select
                          value={category}
                          aria-label={`Categoría para ${tx.description}`}
                          onChange={(e) => handleCategorySelection(tx, e.target.value)}
                          style={inlineStyle}
                          className={`text-2xs font-medium px-2 py-0.5 rounded-full border cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-colors ${isPending
                            ? "bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-400/60 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700 font-semibold"
                            : `${styleClass.bg} ${styleClass.text} ${styleClass.border}`
                            }`}
                          title="Haga clic para cambiar o asignar la categoría"
                        >
                          <option value="Pendiente">Pendiente</option>
                          {availableCategoriesList.map((c) => (
                            <option
                              key={c}
                              value={c}
                              className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                            >
                              {c}
                            </option>
                          ))}
                          <option
                            value="__create_new__"
                            className="bg-zinc-50 font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                          >
                            + Nueva categoría...
                          </option>
                        </select>
                      ) : (
                        <span
                          style={inlineStyle}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border ${styleClass.bg} ${styleClass.text} ${styleClass.border}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${styleClass.dot}`}
                            style={inlineDotStyle}
                          />
                          <span>{category}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-center">
                      {onToggleSubscription ? (
                        <button
                          type="button"
                          onClick={() => onToggleSubscription(tx.id)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border transition-colors cursor-pointer ${tx.isSubscription
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
                            : "bg-transparent text-zinc-400 border-dashed border-zinc-200 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-800 dark:text-zinc-500 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
                            }`}
                          title={
                            tx.isSubscription
                              ? "Suscripción activa. Clic para desmarcar como suscripción."
                              : "Clic para marcar como suscripción recurrente."
                          }
                        >
                          <Icons.CreditCard
                            className={`w-3 h-3 ${tx.isSubscription
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-zinc-400"
                              }`}
                          />
                          <span>
                            {tx.isSubscription ? "Recurrente" : "No recurrente"}
                          </span>
                        </button>
                      ) : tx.isSubscription ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                          <Icons.CreditCard className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          <span>Recurrente</span>
                        </span>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700 text-2xs font-mono">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right font-mono text-zinc-900 dark:text-zinc-100 font-medium">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {tx.originalCurrency === "USD" && (
                          <div className="relative group/usd inline-flex items-center">
                            <span
                              tabIndex={0}
                              role="note"
                              aria-label={`Monto original: $${(tx.originalAmount ?? 0).toFixed(2)} USD | Tipo de cambio: Q ${(tx.exchangeRateApplied ?? 7.85).toFixed(2)}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-sans font-semibold tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 cursor-help transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/50 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                            >
                              <Icons.Globe className="w-2.5 h-2.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              <span>USD</span>
                            </span>
                            {/* Tooltip on hover/focus/tap */}
                            <div
                              role="tooltip"
                              className="absolute right-0 bottom-full mb-1.5 hidden group-hover/usd:flex group-focus-within/usd:flex flex-col z-30 px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white text-2xs font-sans whitespace-nowrap shadow-lg dark:bg-zinc-100 dark:text-zinc-900 pointer-events-none"
                            >
                              <span className="font-semibold">
                                Monto original: ${(tx.originalAmount ?? 0).toFixed(2)} USD
                              </span>
                              <span className="text-3xs text-zinc-300 dark:text-zinc-600">
                                Tipo de cambio: Q {(tx.exchangeRateApplied ?? 7.85).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                        <span>{formatCurrency(tx.amount)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-center">
                      {isDeleting ? (
                        <div className="flex items-center justify-center gap-1.5 text-2xs animate-in fade-in">
                          <span className="text-zinc-500 font-medium">¿Eliminar?</span>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteTransaction?.(tx.id);
                              setDeletingTxId(null);
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                next.delete(tx.id);
                                return next;
                              });
                            }}
                            className="text-red-600 dark:text-red-400 font-bold hover:underline cursor-pointer"
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTxId(null)}
                            className="text-zinc-400 hover:underline cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 text-zinc-400">
                          {onEditTransaction && (
                            <button
                              type="button"
                              onClick={() => startEditing(tx)}
                              className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer"
                              title="Editar transacción"
                            >
                              <Icons.Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteTransaction && (
                            <button
                              type="button"
                              onClick={() => setDeletingTxId(tx.id)}
                              className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors cursor-pointer"
                              title="Eliminar transacción"
                            >
                              <Icons.Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Category Creation Modal */}
      <CustomCategoryModal
        isOpen={isNewCategoryModalOpen}
        existingCategoryNames={availableCategoriesList}
        onSave={(newCategory) => {
          onAddCustomCategory?.(newCategory);
        }}
        onClose={() => setIsNewCategoryModalOpen(false)}
      />

      {/* Batch Category Confirmation Modal */}
      {batchCategoryPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center shrink-0">
                <Icons.HelpCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  ¿Deseas clasificar también los otros gastos similares?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Se encontraron{" "}
                  <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">
                    {batchCategoryPrompt.matchingTransactions.length}{" "}
                    {batchCategoryPrompt.matchingTransactions.length === 1
                      ? "otro gasto"
                      : "otros gastos"}
                  </strong>{" "}
                  con la descripción idéntica:
                </p>
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  &ldquo;{batchCategoryPrompt.transaction.description}&rdquo;
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 pt-1">
                  Nueva categoría:{" "}
                  <strong className="text-zinc-900 dark:text-zinc-100">
                    {batchCategoryPrompt.newCategory}
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setBatchCategoryPrompt(null)}
                className="px-3 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateCategory?.(
                    batchCategoryPrompt.transaction.id,
                    batchCategoryPrompt.newCategory,
                    false
                  );
                  setBatchCategoryPrompt(null);
                }}
                className="px-3 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Solo este gasto
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateCategory?.(
                    batchCategoryPrompt.transaction.id,
                    batchCategoryPrompt.newCategory,
                    true,
                    batchCategoryPrompt.transaction.description
                  );
                  setBatchCategoryPrompt(null);
                }}
                className="px-3.5 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-xs cursor-pointer"
              >
                Cambiar todos ({batchCategoryPrompt.matchingTransactions.length + 1})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
