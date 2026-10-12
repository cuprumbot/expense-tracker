"use client";

import React, { useState, useMemo } from "react";
import { Transaction, CSVParsingSummary } from "@/types/transaction";
import { formatCurrency } from "@/lib/currency";
import { Icons } from "@/components/icons";

interface TransactionTableProps {
  transactions: Transaction[];
  summary: CSVParsingSummary;
  sourceLabel?: string;
  onReset: () => void;
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
}: TransactionTableProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

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
            <thead className="bg-zinc-50 sticky top-0 border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 z-10">
              <tr>
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Descripción</th>
                <th className="px-4 py-2.5 font-medium">Categoría</th>
                <th className="px-4 py-2.5 font-medium text-right">Monto (GTQ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredTransactions.map((tx) => {
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
                      {tx.description}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                        title={isLocal ? "Clasificado localmente en el dispositivo" : "Pendiente de clasificación"}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
                        <span>{category}</span>
                      </span>
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
    </div>
  );
}
