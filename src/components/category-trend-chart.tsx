"use client";

import React, { useState, useMemo } from "react";
import { Transaction, CustomCategory } from "@/types/transaction";
import {
  calculateMonthlyCategoryTrends,
  CategoryMonthlyTrend,
  MonthlyCategoryTrendsResult,
} from "@/lib/reporting";
import { formatCurrency } from "@/lib/currency";
import { Icons } from "@/components/icons";

interface CategoryTrendChartProps {
  transactions: Transaction[];
  customCategories?: CustomCategory[];
}

interface HoveredDataPoint {
  categoryName: string;
  color: string;
  monthKey: string;
  monthLabel: string;
  totalAmount: number;
  changePercent: number | null;
  x: number;
  y: number;
}

const FULL_SPANISH_MONTHS: Record<string, string> = {
  "01": "Enero",
  "02": "Febrero",
  "03": "Marzo",
  "04": "Abril",
  "05": "Mayo",
  "06": "Junio",
  "07": "Julio",
  "08": "Agosto",
  "09": "Septiembre",
  "10": "Octubre",
  "11": "Noviembre",
  "12": "Diciembre",
};

function getFullMonthLabel(monthKey: string): string {
  const parts = monthKey.split("-");
  if (parts.length === 2) {
    const [year, month] = parts;
    const name = FULL_SPANISH_MONTHS[month] || month;
    return `${name} ${year}`;
  }
  return monthKey;
}

/**
 * Creates smooth bezier curve commands between coordinate points.
 */
function createSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const prev = points[i - 1] || current;
    const nextNext = points[i + 2] || next;

    const cp1x = current.x + (next.x - prev.x) * 0.2;
    const cp1y = current.y + (next.y - prev.y) * 0.2;
    const cp2x = next.x - (nextNext.x - current.x) * 0.2;
    const cp2y = next.y - (nextNext.y - current.y) * 0.2;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }

  return d;
}

export function CategoryTrendChart({
  transactions,
  customCategories = [],
}: CategoryTrendChartProps) {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [hoveredPoint, setHoveredPoint] = useState<HoveredDataPoint | null>(null);

  // Compute multi-month trend metrics
  const trendsResult: MonthlyCategoryTrendsResult = useMemo(() => {
    return calculateMonthlyCategoryTrends(transactions, customCategories);
  }, [transactions, customCategories]);

  const { months, trends, isSingleMonth } = trendsResult;

  // Toggle category visibility
  const toggleCategory = (categoryId: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        // Prevent hiding all categories
        if (next.size < trends.length - 1) {
          next.add(categoryId);
        }
      }
      return next;
    });
  };

  // Visible trends
  const visibleTrends = useMemo(() => {
    return trends.filter((t) => !hiddenCategories.has(t.categoryId));
  }, [trends, hiddenCategories]);

  // Compute dynamic peak ceiling
  const yCeiling = useMemo(() => {
    let peak = 0;
    for (const t of visibleTrends) {
      for (const m of t.monthlyTotals) {
        if (m.totalAmount > peak) peak = m.totalAmount;
      }
    }
    if (peak <= 0) return 1000;
    // Round up to clean increments
    const magnitude = Math.pow(10, Math.floor(Math.log10(peak)));
    const multiple = Math.ceil(peak / magnitude);
    return Math.max(multiple * magnitude, 500);
  }, [visibleTrends]);

  // SVG layout constants
  const svgWidth = 560;
  const svgHeight = 240;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 40;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Calculate coordinates helper
  const getCoordinates = (monthIndex: number, amount: number) => {
    const x =
      months.length > 1
        ? padLeft + (monthIndex / (months.length - 1)) * plotWidth
        : padLeft + plotWidth / 2;
    const clampedAmount = Math.max(0, Math.min(amount, yCeiling));
    const y = padTop + plotHeight - (clampedAmount / yCeiling) * plotHeight;
    return { x, y };
  };

  // Y-axis grid ticks (4 steps: 0%, 33%, 66%, 100%)
  const yTicks = useMemo(() => {
    return [
      { val: yCeiling, y: padTop },
      { val: yCeiling * 0.66, y: padTop + plotHeight * 0.34 },
      { val: yCeiling * 0.33, y: padTop + plotHeight * 0.67 },
      { val: 0, y: padTop + plotHeight },
    ];
  }, [yCeiling, padTop, plotHeight]);

  if (trends.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-400">
        <Icons.TrendingDown className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          No hay gastos disponibles para calcular la tendencia mensual.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Informative banner for single-month statement */}
      {isSingleMonth && (
        <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/30 flex items-center gap-2 text-2xs text-blue-800 dark:text-blue-300">
          <Icons.Info className="w-3.5 h-3.5 shrink-0" />
          <span>
            Se detectó 1 solo mes cargado ({months[0]?.monthLabel || ""}). Carga estados de cuenta adicionales para trazar la línea de evolución continua.
          </span>
        </div>
      )}

      {/* Interactive Category Filter Pills Bar */}
      <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto pr-1">
        <span className="text-3xs font-semibold uppercase tracking-wider text-zinc-400 mr-1 select-none">
          Categorías:
        </span>
        {trends.map((cat) => {
          const isHidden = hiddenCategories.has(cat.categoryId);
          const totalCategorySpend = cat.monthlyTotals.reduce(
            (acc, m) => acc + m.totalAmount,
            0
          );

          return (
            <button
              key={cat.categoryId}
              type="button"
              onClick={() => toggleCategory(cat.categoryId)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-medium border transition-all cursor-pointer ${
                isHidden
                  ? "bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-900/50 dark:text-zinc-500 dark:border-zinc-800 line-through opacity-50"
                  : "bg-white text-zinc-800 border-zinc-200 shadow-2xs hover:border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-800"
              }`}
              title={
                isHidden
                  ? `Mostrar ${cat.categoryName} en el gráfico`
                  : `Ocultar ${cat.categoryName} del gráfico`
              }
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="truncate max-w-[120px]">{cat.categoryName}</span>
              <span className="text-3xs font-mono opacity-70">
                {formatCurrency(totalCategorySpend)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Responsive SVG Chart Container */}
      <div className="relative flex-1 w-full min-h-[220px] select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full overflow-visible"
          role="img"
          aria-label="Gráfico de tendencia mensual por categoría"
        >
          {/* Background horizontal grid lines & Y labels */}
          {yTicks.map((tick, idx) => (
            <g key={`ytick-${idx}`}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={padLeft + plotWidth}
                y2={tick.y}
                stroke="currentColor"
                className="text-zinc-200 dark:text-zinc-800/80 stroke-dasharray-[2,3]"
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={tick.y + 3}
                textAnchor="end"
                className="text-[10px] font-mono fill-zinc-400 dark:fill-zinc-500"
              >
                {tick.val >= 1000
                  ? `Q ${(tick.val / 1000).toFixed(tick.val % 1000 === 0 ? 0 : 1)}k`
                  : `Q ${Math.round(tick.val)}`}
              </text>
            </g>
          ))}

          {/* X-axis labels & vertical tick marks */}
          {months.map((m, mIdx) => {
            const { x } = getCoordinates(mIdx, 0);
            return (
              <g key={`xtick-${m.monthKey}`}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + plotHeight}
                  stroke="currentColor"
                  className="text-zinc-100 dark:text-zinc-900"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={padTop + plotHeight + 18}
                  textAnchor="middle"
                  className="text-[11px] font-medium fill-zinc-600 dark:fill-zinc-400"
                >
                  {m.monthLabel}
                </text>
              </g>
            );
          })}

          {/* Render category paths & data points */}
          {visibleTrends.map((cat) => {
            const points = cat.monthlyTotals.map((mt, mIdx) =>
              getCoordinates(mIdx, mt.totalAmount)
            );
            const pathD = createSmoothPath(points);

            return (
              <g key={`path-group-${cat.categoryId}`}>
                {/* Line Path */}
                {months.length > 1 && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={cat.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-300"
                  />
                )}

                {/* Data Points */}
                {cat.monthlyTotals.map((mt, mIdx) => {
                  const { x, y } = points[mIdx];
                  const prevAmount =
                    mIdx > 0 ? cat.monthlyTotals[mIdx - 1].totalAmount : null;
                  let changePercent: number | null = null;
                  if (prevAmount !== null && prevAmount > 0) {
                    changePercent = Number(
                      (((mt.totalAmount - prevAmount) / prevAmount) * 100).toFixed(1)
                    );
                  }

                  const isHovered =
                    hoveredPoint?.categoryName === cat.categoryName &&
                    hoveredPoint?.monthKey === mt.monthKey;

                  return (
                    <circle
                      key={`point-${cat.categoryId}-${mt.monthKey}`}
                      cx={x}
                      cy={y}
                      r={isHovered ? 6.5 : isSingleMonth ? 6 : 4}
                      fill={cat.color}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? "2.5" : "1.5"}
                      className="cursor-pointer transition-transform duration-150 hover:scale-125 dark:stroke-zinc-950"
                      onMouseEnter={() =>
                        setHoveredPoint({
                          categoryName: cat.categoryName,
                          color: cat.color,
                          monthKey: mt.monthKey,
                          monthLabel: mt.monthLabel,
                          totalAmount: mt.totalAmount,
                          changePercent,
                          x,
                          y,
                        })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Hover / Tap Tooltip Card */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full mb-3 px-3 py-2 rounded-xl bg-zinc-900/95 dark:bg-zinc-100/95 text-white dark:text-zinc-900 shadow-xl border border-zinc-700/50 dark:border-zinc-300/50 backdrop-blur-md min-w-[150px] animate-in fade-in zoom-in-95 duration-150"
            style={{
              left: `${(hoveredPoint.x / svgWidth) * 100}%`,
              top: `${(hoveredPoint.y / svgHeight) * 100}%`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-zinc-700 dark:border-zinc-300">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: hoveredPoint.color }}
              />
              <span className="text-xs font-semibold truncate">
                {hoveredPoint.categoryName}
              </span>
            </div>

            <div className="space-y-0.5 text-2xs">
              <div className="flex justify-between items-center text-zinc-300 dark:text-zinc-600">
                <span>Mes:</span>
                <span className="font-medium">
                  {getFullMonthLabel(hoveredPoint.monthKey)}
                </span>
              </div>

              <div className="flex justify-between items-center font-bold">
                <span>Gasto:</span>
                <span className="font-mono">
                  {formatCurrency(hoveredPoint.totalAmount)}
                </span>
              </div>

              {hoveredPoint.changePercent !== null && (
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-zinc-400 dark:text-zinc-500">Variación:</span>
                  <span
                    className={`font-mono font-semibold ${
                      hoveredPoint.changePercent > 0
                        ? "text-rose-400 dark:text-rose-600"
                        : hoveredPoint.changePercent < 0
                        ? "text-emerald-400 dark:text-emerald-600"
                        : "text-zinc-300 dark:text-zinc-700"
                    }`}
                  >
                    {hoveredPoint.changePercent > 0 ? "+" : ""}
                    {hoveredPoint.changePercent}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
