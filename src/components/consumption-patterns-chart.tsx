"use client";

import React, { useState, useMemo } from "react";
import { Transaction } from "@/types/transaction";
import {
  calculateConsumptionPatterns,
  ConsumptionPatternsResult,
  TemporalPatternItem,
} from "@/lib/reporting";
import { formatCurrency } from "@/lib/currency";
import { Icons } from "@/components/icons";

interface ConsumptionPatternsChartProps {
  transactions: Transaction[];
}

type PatternMode = "dayOfWeek" | "dayOfMonth";

export function ConsumptionPatternsChart({
  transactions,
}: ConsumptionPatternsChartProps) {
  const [patternMode, setPatternMode] = useState<PatternMode>("dayOfWeek");
  const [hoveredItem, setHoveredItem] = useState<TemporalPatternItem | null>(null);

  // Compute spending patterns and anomaly heuristics
  const patterns: ConsumptionPatternsResult = useMemo(() => {
    return calculateConsumptionPatterns(transactions);
  }, [transactions]);

  const activeGroup =
    patternMode === "dayOfWeek" ? patterns.dayOfWeek : patterns.dayOfMonth;
  const activeItems: TemporalPatternItem[] = activeGroup.items;

  const maxAmount = useMemo(() => {
    return activeGroup.peakAmount > 0 ? activeGroup.peakAmount : 1;
  }, [activeGroup.peakAmount]);

  const hasOutliers = useMemo(() => {
    return activeItems.some((i) => i.isOutlier);
  }, [activeItems]);

  const activeInsight = useMemo(() => {
    const targetType = patternMode === "dayOfWeek" ? "day_of_week" : "day_of_month";
    return patterns.insights.find((ins) => ins.type === targetType) || patterns.insights[0];
  }, [patterns.insights, patternMode]);

  if (transactions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-400">
        <Icons.Calendar className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          No hay transacciones registradas para analizar patrones de consumo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-3.5">
      {/* Top Controls: Mode Switcher */}
      <div className="flex items-center justify-between gap-2 pb-1">
        <span className="text-3xs font-semibold uppercase tracking-wider text-zinc-400 select-none">
          Visualizar por:
        </span>
        <div className="inline-flex p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            id="btn-pattern-day-of-week"
            onClick={() => {
              setPatternMode("dayOfWeek");
              setHoveredItem(null);
            }}
            className={`px-2.5 py-1 text-2xs font-medium rounded-md transition-all cursor-pointer ${
              patternMode === "dayOfWeek"
                ? "bg-white text-zinc-900 shadow-2xs font-semibold dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Día de la semana (7 días)
          </button>
          <button
            type="button"
            id="btn-pattern-day-of-month"
            onClick={() => {
              setPatternMode("dayOfMonth");
              setHoveredItem(null);
            }}
            className={`px-2.5 py-1 text-2xs font-medium rounded-md transition-all cursor-pointer ${
              patternMode === "dayOfMonth"
                ? "bg-white text-zinc-900 shadow-2xs font-semibold dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Día del mes (1 a 31)
          </button>
        </div>
      </div>

      {/* Bar Chart Container */}
      <div className="relative flex-1 min-h-[170px] flex flex-col justify-end pt-5 pb-2 px-1 rounded-xl bg-zinc-50/60 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-850">
        {/* Dynamic Hover Tooltip Banner */}
        <div className="absolute top-2 left-3 right-3 flex items-center justify-between pointer-events-none text-2xs">
          {hoveredItem ? (
            <div className="flex items-center gap-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {hoveredItem.label}
              </span>
              <span className="text-zinc-400">·</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(hoveredItem.totalAmountGTQ)}
              </span>
              <span className="text-zinc-500 font-mono">
                ({hoveredItem.percentage}%)
              </span>
              <span className="text-zinc-400">·</span>
              <span className="text-zinc-500">
                {hoveredItem.transactionCount}{" "}
                {hoveredItem.transactionCount === 1 ? "compra" : "compras"}
              </span>
              {hoveredItem.isOutlier && (
                <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-bold uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                  <Icons.AlertCircle className="w-2.5 h-2.5" />
                  Atípico
                </span>
              )}
            </div>
          ) : (
            <div className="text-3xs text-zinc-400 flex items-center gap-1.5">
              <span>Pasa el cursor sobre cualquier barra para ver detalles</span>
            </div>
          )}
        </div>

        {/* Vertical Bars */}
        <div className="flex items-end justify-between gap-1 sm:gap-2 h-32 pt-5">
          {activeItems.map((item) => {
            const heightPercent =
              maxAmount > 0
                ? Math.max(
                    item.totalAmountGTQ > 0 ? 8 : 2,
                    Math.round((item.totalAmountGTQ / maxAmount) * 100)
                  )
                : 2;

            const isHovered = hoveredItem?.key === item.key;

            return (
              <div
                key={`day-${patternMode}-${item.key}`}
                className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                onMouseEnter={() => setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Outlier Badge Indicator */}
                {item.isOutlier && (
                  <div
                    className="mb-1 text-rose-500 dark:text-rose-400 animate-pulse transition-transform group-hover:scale-125"
                    title={item.outlierReason || "Gasto atípico detectado"}
                  >
                    <Icons.AlertCircle className="w-3.5 h-3.5" />
                  </div>
                )}

                {/* Bar */}
                <div className="w-full relative flex items-end justify-center h-full">
                  <div
                    className={`w-full rounded-t-md transition-all duration-200 ${
                      item.isOutlier
                        ? isHovered
                          ? "bg-rose-600 dark:bg-rose-500 ring-2 ring-rose-400"
                          : "bg-rose-500/90 dark:bg-rose-500 ring-1 ring-rose-400/50"
                        : isHovered
                        ? "bg-blue-600 dark:bg-blue-500"
                        : item.totalAmountGTQ > 0
                        ? "bg-blue-500/70 dark:bg-blue-600/70 group-hover:bg-blue-500"
                        : "bg-zinc-200 dark:bg-zinc-800"
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>

                {/* X-Axis Label */}
                <div className="mt-1.5 text-center">
                  <span
                    className={`block font-mono select-none leading-none ${
                      patternMode === "dayOfWeek"
                        ? "text-2xs font-semibold"
                        : "text-3xs"
                    } ${
                      item.isOutlier
                        ? "text-rose-600 dark:text-rose-400 font-bold"
                        : isHovered
                        ? "text-zinc-900 dark:text-zinc-100 font-bold"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {patternMode === "dayOfWeek"
                      ? item.shortLabel
                      : parseInt(item.key, 10) % 2 === 1 || item.isOutlier
                      ? item.shortLabel
                      : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Outlier / Contextual Anomaly Insight Banner */}
      <div
        id="consumption-anomaly-banner"
        className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-colors ${
          activeInsight?.isAnomaly
            ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200"
            : "bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
        }`}
      >
        <div
          className={`p-1 rounded-md shrink-0 mt-0.5 ${
            activeInsight?.isAnomaly
              ? "bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300"
              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {activeInsight?.isAnomaly ? (
            <Icons.AlertCircle className="w-3.5 h-3.5" />
          ) : (
            <Icons.CheckCircle2 className="w-3.5 h-3.5" />
          )}
        </div>

        <div className="flex-1 space-y-0.5 min-w-0">
          <p className="font-semibold text-2xs uppercase tracking-wide">
            {activeInsight?.title || (hasOutliers ? "Hallazgo de Consumo" : "Patrón Estable")}
          </p>
          <p className="text-2xs leading-relaxed">
            {activeInsight?.description ||
              "Tus gastos se distribuyen de manera regular sin picos atípicos significativos durante el período analizado."}
          </p>
        </div>
      </div>
    </div>
  );
}
