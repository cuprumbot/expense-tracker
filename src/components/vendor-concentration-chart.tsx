"use client";

import React, { useState, useMemo } from "react";
import { Transaction, CustomCategory } from "@/types/transaction";
import {
  calculateTopVendors,
  TopVendorsResult,
  VendorAggregationItem,
  DEFAULT_CATEGORY_COLORS,
} from "@/lib/reporting";
import { formatCurrency } from "@/lib/currency";
import { Icons } from "@/components/icons";

interface VendorConcentrationChartProps {
  transactions: Transaction[];
  customCategories?: CustomCategory[];
}

type MetricMode = "amount" | "frequency";

export function VendorConcentrationChart({
  transactions,
  customCategories = [],
}: VendorConcentrationChartProps) {
  const [metricMode, setMetricMode] = useState<MetricMode>("amount");
  const [hoveredVendor, setHoveredVendor] = useState<VendorAggregationItem | null>(null);

  // Compute top vendors
  const vendorsResult: TopVendorsResult = useMemo(() => {
    return calculateTopVendors(transactions, 5);
  }, [transactions]);

  const activeVendors =
    metricMode === "amount" ? vendorsResult.byAmount : vendorsResult.byFrequency;

  // Max value for scaling bar widths
  const maxMetricValue = useMemo(() => {
    if (activeVendors.length === 0) return 1;
    if (metricMode === "amount") {
      return activeVendors[0]?.totalAmountGTQ || 1;
    }
    return activeVendors[0]?.transactionCount || 1;
  }, [activeVendors, metricMode]);

  const resolveCategoryColor = (categoryName: string): string => {
    const custom = customCategories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase()
    );
    if (custom && custom.color) return custom.color;
    return DEFAULT_CATEGORY_COLORS[categoryName] || "#f59e0b";
  };

  if (activeVendors.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-400">
        <Icons.Building2 className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          No hay compras suficientes para calcular la concentración de comercios.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Top Segmented Dual Metric Selector */}
      <div className="flex items-center justify-between gap-2 pb-0.5">
        <span className="text-3xs font-semibold uppercase tracking-wider text-zinc-400 select-none">
          Ordenar por:
        </span>
        <div className="inline-flex p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            id="btn-vendor-sort-amount"
            onClick={() => setMetricMode("amount")}
            className={`px-2.5 py-1 text-2xs font-medium rounded-md transition-all cursor-pointer ${
              metricMode === "amount"
                ? "bg-white text-zinc-900 shadow-2xs font-semibold dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Mayor monto gastado (Q)
          </button>
          <button
            type="button"
            id="btn-vendor-sort-frequency"
            onClick={() => setMetricMode("frequency")}
            className={`px-2.5 py-1 text-2xs font-medium rounded-md transition-all cursor-pointer ${
              metricMode === "frequency"
                ? "bg-white text-zinc-900 shadow-2xs font-semibold dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Mayor cantidad de compras
          </button>
        </div>
      </div>

      {/* Bar List */}
      <div className="flex-1 space-y-1.5">
        {activeVendors.map((item, index) => {
          const barValue =
            metricMode === "amount" ? item.totalAmountGTQ : item.transactionCount;
          const barWidthPercent =
            maxMetricValue > 0
              ? Math.max(8, Math.min(100, (barValue / maxMetricValue) * 100))
              : 0;
          const catColor = resolveCategoryColor(item.category);

          return (
            <div
              key={`vendor-${item.merchantName}`}
              className="group relative p-1.5 sm:p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
              onMouseEnter={() => setHoveredVendor(item)}
              onMouseLeave={() => setHoveredVendor(null)}
            >
              {/* Header: Rank + Name + Amount/Count Label */}
              <div className="flex items-center justify-between gap-2 mb-1 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-4 text-2xs font-mono font-bold text-zinc-400 text-center shrink-0">
                    {index + 1}
                  </span>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: catColor }}
                  />
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {item.merchantName}
                  </span>
                </div>

                <div className="text-right shrink-0 font-mono text-2xs">
                  {metricMode === "amount" ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(item.totalAmountGTQ)}
                      </span>
                      <span className="text-zinc-400">({item.percentageShare}%)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        {item.transactionCount} {item.transactionCount === 1 ? "compra" : "compras"}
                      </span>
                      <span className="text-zinc-400">
                        (Total: {formatCurrency(item.totalAmountGTQ)})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar Track & Bar */}
              <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 ease-in-out"
                  style={{
                    width: `${barWidthPercent}%`,
                    backgroundColor: catColor,
                  }}
                />
              </div>


              {/* Hover Tooltip card with Average Ticket size */}
              {hoveredVendor?.merchantName === item.merchantName && (
                <div className="pointer-events-none absolute right-4 bottom-full mb-1 z-20 p-2.5 rounded-xl bg-zinc-900/95 dark:bg-zinc-100/95 text-white dark:text-zinc-900 shadow-xl border border-zinc-700/50 dark:border-zinc-300/50 backdrop-blur-md text-2xs space-y-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center gap-1.5 font-bold border-b border-zinc-700 dark:border-zinc-300 pb-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: catColor }}
                    />
                    <span className="truncate">{item.merchantName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-300 dark:text-zinc-600">Categoría:</span>
                    <span className="font-medium">{item.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-300 dark:text-zinc-600">Total gastado:</span>
                    <span className="font-mono font-bold">
                      {formatCurrency(item.totalAmountGTQ)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-300 dark:text-zinc-600">Total transacciones:</span>
                    <span className="font-mono">{item.transactionCount}</span>
                  </div>
                  <div className="flex justify-between pt-0.5 border-t border-zinc-800 dark:border-zinc-200">
                    <span className="text-emerald-400 dark:text-emerald-600 font-semibold">
                      Monto promedio por compra:
                    </span>
                    <span className="font-mono font-bold text-emerald-400 dark:text-emerald-600">
                      {formatCurrency(item.averageTicketGTQ)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
