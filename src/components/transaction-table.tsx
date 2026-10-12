"use client";

import React, { useState, useMemo } from "react";
import { Transaction, CSVParsingSummary } from "@/types/transaction";
import { formatCurrency } from "@/lib/currency";
import {
  getSubscriptionSummary,
  UNCLASSIFIED_THRESHOLD,
  AVAILABLE_CATEGORIES,
} from "@/lib/expense-classifier";
import { Icons } from "@/components/icons";

interface TransactionTableProps {
  transactions: Transaction[];
  summary: CSVParsingSummary;
  sourceLabel?: string;
  onReset: () => void;
  onUpdateCategory?: (
    transactionId: string,
    newCategory: string,
    applyToAllWithSameDescription?: boolean,
    targetDescription?: string
  ) => void;
  onClassifyPendingWithLLM?: () => void;
  isClassifyingWithLLM?: boolean;
  llmClassificationError?: string | null;
  llmSuccessMessage?: string | null;
}

type SortField = "date" | "description" | "amount";
type SortDirection = "asc" | "desc";

function parseDateForSort(dateStr: string): number {
  if (!dateStr) return 0;
  const trimmed = dateStr.trim();
  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
  }
  // DD/MM/YYYY or DD-MM-YYYY
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
    bg: "bg-zinc-100 dark:bg-zinc-800/70",
    text: "text-zinc-600 dark:text-zinc-400",
    border: "border-zinc-200 dark:border-zinc-700",
    dot: "bg-zinc-400",
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
  onReset,
  onUpdateCategory,
  onClassifyPendingWithLLM,
  isClassifyingWithLLM = false,
  llmClassificationError = null,
  llmSuccessMessage = null,
}: TransactionTableProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [batchCategoryPrompt, setBatchCategoryPrompt] = useState<{
    transaction: Transaction;
    newCategory: string;
    matchingTransactions: Transaction[];
  } | null>(null);

  // Metrics calculation
  const stats = useMemo(() => {
    let classified = 0;
    let pending = 0;
    const categoryTotals: Record<string, { count: number; total: number }> = {};

    for (const tx of transactions) {
      const cat = tx.category || "Pendiente";
      const isPending = cat === "Pendiente";

      if (isPending) {
        pending++;
      } else {
        classified++;
      }

      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { count: 0, total: 0 };
      }
      categoryTotals[cat].count++;
      categoryTotals[cat].total += tx.amount;
    }

    return {
      classified,
      pending,
      categoryTotals,
    };
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (selectedCategory === "all") return transactions;
    return transactions.filter(
      (tx) => (tx.category || "Pendiente") === selectedCategory
    );
  }, [transactions, selectedCategory]);

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

  const uniqueCategories = useMemo(() => {
    return Object.keys(stats.categoryTotals).sort((a, b) => {
      if (a === "Pendiente") return 1;
      if (b === "Pendiente") return -1;
      return stats.categoryTotals[b].count - stats.categoryTotals[a].count;
    });
  }, [stats.categoryTotals]);

  const availableCategoriesList = useMemo(() => {
    const set = new Set([
      ...AVAILABLE_CATEGORIES,
      ...uniqueCategories.filter((c) => c !== "Pendiente"),
    ]);
    return Array.from(set);
  }, [uniqueCategories]);

  const subscriptionSummary = useMemo(() => {
    return getSubscriptionSummary(transactions);
  }, [transactions]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleCategorySelection = (tx: Transaction, targetCategory: string) => {
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

  return (
    <div className="space-y-6">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-2xs font-medium text-zinc-500 uppercase tracking-wider">
            Total de gastos
          </p>
          <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
            {formatCurrency(summary.totalAmount)}
          </p>
          <p className="text-2xs text-zinc-400 mt-1">
            {transactions.length} transacciones
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-2xs font-medium text-zinc-500 uppercase tracking-wider">
            Clasificados localmente
          </p>
          <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.classified} de {transactions.length}
          </p>
          <p className="text-2xs text-zinc-400 mt-1">
            {Math.round((stats.classified / (transactions.length || 1)) * 100)}% categorizados
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-2xs font-medium text-zinc-500 uppercase tracking-wider">
            Gastos pendientes
          </p>
          <p className="text-xl font-semibold text-zinc-700 dark:text-zinc-300 mt-1">
            {stats.pending}
          </p>
          <p className="text-2xs text-zinc-400 mt-1">
            {stats.pending > 0 ? "Requieren revisión o IA" : "Todos categorizados"}
          </p>
        </div>
      </div>

      {/* Subscriptions Audit Banner (US-008) */}
      {subscriptionSummary.count > 0 && (
        <div className="p-4 rounded-xl border border-indigo-200/90 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center dark:bg-indigo-900/70 dark:text-indigo-300">
                <Icons.CreditCard className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-indigo-950 dark:text-indigo-200">
                  Suscripciones recurrentes detectadas
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
              <span className="text-sm font-semibold font-mono text-indigo-950 dark:text-indigo-100">
                {formatCurrency(subscriptionSummary.totalMonthlyCommitment)}
              </span>
            </div>
          </div>

          <p className="text-xs text-indigo-900/80 dark:text-indigo-300/80 leading-relaxed">
            Se identificaron cargos automáticos en servicios digitales. Audita estas suscripciones para evaluar si deseas mantenerlas activas o cancelar servicios no utilizados.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-indigo-200/60 dark:border-indigo-900/40">
            {subscriptionSummary.services.map((sub, idx) => (
              <span
                key={`${sub.name}-${idx}`}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-2xs font-medium bg-white border border-indigo-200 text-indigo-900 dark:bg-zinc-900 dark:border-indigo-800 dark:text-indigo-300 shadow-2xs"
              >
                <span>{sub.name}</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(sub.amount)}
                </span>
              </span>
            ))}

            {selectedCategory !== "Suscripciones" && (
              <button
                type="button"
                onClick={() => setSelectedCategory("Suscripciones")}
                className="text-2xs font-medium text-indigo-700 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 underline ml-auto cursor-pointer"
              >
                Filtrar solo suscripciones
              </button>
            )}
          </div>
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

      {/* AI Classification Banner (> 5 pending, US-009) */}
      {stats.pending > UNCLASSIFIED_THRESHOLD && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Icons.Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                  {stats.pending === 1
                    ? "Tienes 1 gasto pendiente de clasificar, espera mientras la IA lo clasifica..."
                    : `Tienes ${stats.pending} gastos pendientes de clasificar, espera mientras la IA los clasifica...`}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onClassifyPendingWithLLM && (
                <button
                  type="button"
                  disabled={isClassifyingWithLLM}
                  onClick={onClassifyPendingWithLLM}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-lg dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-xs cursor-pointer"
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
              )}
              <button
                type="button"
                onClick={() => setSelectedCategory("Pendiente")}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-900 bg-amber-100/80 hover:bg-amber-200/80 rounded-lg dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
              >
                <span>Ver pendientes ({stats.pending})</span>
              </button>
            </div>
          </div>

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
        </div>
      )}

      {/* Manual Categorization Prompt (<= 5 pending, US-009) */}
      {stats.pending > 0 && stats.pending <= UNCLASSIFIED_THRESHOLD && (
        <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 flex items-center justify-center shrink-0">
              <Icons.Tag className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {stats.pending === 1
                  ? "1 gasto pendiente de clasificar, clasifícalo para continuar"
                  : `${stats.pending} gastos pendientes de clasificar, clasifícalos para continuar`}
              </span>
            </div>
          </div>

          {selectedCategory !== "Pendiente" && (
            <button
              type="button"
              onClick={() => setSelectedCategory("Pendiente")}
              className="text-2xs font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 underline cursor-pointer"
            >
              Filtrar solo pendientes ({stats.pending})
            </button>
          )}
        </div>
      )}

      {/* Category Pills Filter */}
      {uniqueCategories.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="font-medium">Filtrar por categoría:</span>
            {selectedCategory !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className="text-2xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline"
              >
                Mostrar todos ({transactions.length})
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                selectedCategory === "all"
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                  : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-800"
              }`}
            >
              <span>Todos</span>
              <span className="text-2xs opacity-75">({transactions.length})</span>
            </button>

            {uniqueCategories.map((cat) => {
              const info = stats.categoryTotals[cat];
              const style = CATEGORY_STYLES[cat] || DEFAULT_STYLE;
              const isSelected = selectedCategory === cat;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    isSelected
                      ? `${style.bg} ${style.text} ${style.border} ring-1 ring-current`
                      : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  <span>{cat}</span>
                  <span className="text-2xs opacity-75">({info.count})</span>
                </button>
              );
            })}
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

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:text-zinc-400 dark:border-zinc-700 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <Icons.RefreshCw className="w-3.5 h-3.5" />
            <span>Cargar otro archivo</span>
          </button>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-zinc-50 sticky top-0 border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 z-10 select-none">
              <tr>
                <th className="px-4 py-2.5 font-medium">
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
                <th className="px-4 py-2.5 font-medium">
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
                <th className="px-4 py-2.5 font-medium">Categoría</th>
                <th className="px-4 py-2.5 font-medium text-right">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sortedTransactions.map((tx) => {
                const category = tx.category || "Pendiente";
                const catStyle = CATEGORY_STYLES[category] || DEFAULT_STYLE;
                const isLocal = tx.classificationSource === "local";

                return (
                  <tr
                    key={tx.id}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60 transition-colors"
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap text-zinc-500 font-mono text-2xs">
                      {tx.date}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-100 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{tx.description}</span>
                        {tx.isSubscription && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.2 rounded text-3xs font-mono font-normal bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
                            title="Suscripción recurrente detectada"
                          >
                            Recurrente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {onUpdateCategory ? (
                          <select
                            value={category}
                            aria-label={`Categoría para ${tx.description}`}
                            onChange={(e) => handleCategorySelection(tx, e.target.value)}
                            className={`text-2xs font-medium px-2 py-0.5 rounded-full border cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-colors ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                            title="Haga clic para cambiar o asignar la categoría manualmente"
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
                          </select>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
                            <span>{category}</span>
                          </span>
                        )}

                        {/* Source Tag */}
                        {isLocal && (
                          <span
                            className="text-3xs font-mono px-1 py-0.2 rounded bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                            title="Clasificado localmente en el dispositivo"
                          >
                            Local
                          </span>
                        )}
                        {tx.classificationSource === "llm" && (
                          <span
                            className="text-3xs font-mono px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-semibold"
                            title="Clasificado con IA (Gemini Pro)"
                          >
                            IA
                          </span>
                        )}
                        {tx.classificationSource === "manual" && (
                          <span
                            className="text-3xs font-mono px-1 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-semibold"
                            title="Asignado manualmente por el usuario"
                          >
                            Manual
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-right font-mono text-zinc-900 dark:text-zinc-100 font-medium">
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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
