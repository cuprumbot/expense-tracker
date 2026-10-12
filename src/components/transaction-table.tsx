"use client";

import React from "react";
import { Transaction, CSVParsingSummary } from "@/types/transaction";
import { formatCurrency } from "@/lib/currency";
import { Icons } from "@/components/icons";

interface TransactionTableProps {
  transactions: Transaction[];
  summary: CSVParsingSummary;
  sourceLabel?: string;
  onReset: () => void;
}

export function TransactionTable({
  transactions,
  summary,
  sourceLabel = "Archivo CSV",
  onReset,
}: TransactionTableProps) {
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
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-2xs font-medium text-zinc-500 uppercase tracking-wider">
            Transacciones extraídas
          </p>
          <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
            {summary.validTransactionsCount}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-2xs font-medium text-zinc-500 uppercase tracking-wider">
            Filas omitidas / encabezados
          </p>
          <p className="text-xl font-semibold text-zinc-500 dark:text-zinc-400 mt-1">
            {summary.skippedRowsCount}
          </p>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="border border-zinc-200 rounded-xl bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Movimientos extraídos
            </span>
            <span className="text-2xs font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {sourceLabel}
            </span>
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
            <thead className="bg-zinc-50 sticky top-0 border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Descripción</th>
                <th className="px-4 py-2.5 font-medium text-right">Monto (GTQ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {transactions.map((tx) => (
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
                  <td className="px-4 py-2.5 whitespace-nowrap text-right font-mono text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
