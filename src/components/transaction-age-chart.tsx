"use client";

import React, { useState, useMemo } from "react";
import { Transaction } from "@/types/transaction";
import {
  calculateTransactionAgeSegments,
  TransactionAgeResult,
  TransactionAgeSegment,
} from "@/lib/reporting";
import { formatCurrency } from "@/lib/currency";
import { Icons } from "@/components/icons";

interface TransactionAgeChartProps {
  transactions: Transaction[];
}

export function TransactionAgeChart({ transactions }: TransactionAgeChartProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [hoveredSegment, setHoveredSegment] = useState<TransactionAgeSegment | null>(
    null
  );

  // Compute 3-segment transaction age metrics
  const ageResult: TransactionAgeResult = useMemo(() => {
    return calculateTransactionAgeSegments(transactions, selectedMonth);
  }, [transactions, selectedMonth]);

  const {
    segments,
    totalFilteredAmountGTQ,
    totalFilteredCount,
    availableMonths,
  } = ageResult;

  // SVG Donut geometry
  const size = 180;
  const strokeWidth = 20;
  const hoverStrokeWidth = 26;
  const radius = (size - hoverStrokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate stroke offsets for each slice
  let cumulativePercent = 0;
  const slicesWithOffsets = segments.map((segment) => {
    const fraction =
      totalFilteredAmountGTQ > 0
        ? segment.totalAmountGTQ / totalFilteredAmountGTQ
        : 0;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativePercent * circumference;
    cumulativePercent += fraction;

    return {
      ...segment,
      fraction,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="flex flex-col h-full space-y-3.5">
      {/* Top Filter Controls */}
      <div className="flex items-center justify-between gap-2 pb-1">
        <label
          htmlFor="select-transaction-age-month"
          className="text-3xs font-semibold uppercase tracking-wider text-zinc-400 select-none"
        >
          Filtrar período:
        </label>
        <div className="relative">
          <select
            id="select-transaction-age-month"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setHoveredSegment(null);
            }}
            className="text-2xs font-medium bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 text-zinc-900 dark:text-zinc-100 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
          >
            <option value="all">Todos los meses cargados</option>
            {availableMonths.map((m) => (
              <option key={`opt-month-${m.monthKey}`} value={m.monthKey}>
                {m.monthLabel}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content: Donut Chart + Breakdown Legend */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        {/* Left: SVG Donut Chart */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center relative py-1">
          <div className="relative w-[180px] h-[180px] flex items-center justify-center">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full -rotate-90 transform"
              aria-label="Gráfico de anillo de antigüedad del gasto"
            >
              {/* Background empty track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-zinc-100 dark:text-zinc-850"
              />

              {/* Slices */}
              {totalFilteredAmountGTQ > 0 &&
                slicesWithOffsets.map((slice) => {
                  if (slice.fraction <= 0) return null;
                  const isHovered = hoveredSegment?.id === slice.id;

                  return (
                    <circle
                      key={`slice-${slice.id}`}
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={isHovered ? hoverStrokeWidth : strokeWidth}
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      className="transition-all duration-200 cursor-pointer origin-center"
                      onMouseEnter={() => setHoveredSegment(slice)}
                      onMouseLeave={() => setHoveredSegment(null)}
                    />
                  );
                })}
            </svg>

            {/* Donut Center Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
              <span className="text-3xs uppercase tracking-wider font-semibold text-zinc-400">
                {hoveredSegment ? hoveredSegment.label : "Total Período"}
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">
                {formatCurrency(
                  hoveredSegment
                    ? hoveredSegment.totalAmountGTQ
                    : totalFilteredAmountGTQ
                )}
              </span>
              <span className="text-3xs font-mono text-zinc-500">
                {hoveredSegment
                  ? `${hoveredSegment.percentageShare}% (${hoveredSegment.transactionCount} mov.)`
                  : `${totalFilteredCount} compras`}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Legend Breakdown Cards */}
        <div className="sm:col-span-7 flex flex-col space-y-2">
          {segments.map((seg) => {
            const isHovered = hoveredSegment?.id === seg.id;

            return (
              <div
                key={`legend-${seg.id}`}
                id={`legend-segment-${seg.id}`}
                onMouseEnter={() => setHoveredSegment(seg)}
                onMouseLeave={() => setHoveredSegment(null)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isHovered
                    ? "bg-zinc-50 dark:bg-zinc-900/70 border-zinc-300 dark:border-zinc-700 shadow-2xs"
                    : "bg-white dark:bg-zinc-950 border-zinc-150 dark:border-zinc-850 hover:border-zinc-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {seg.label}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(seg.totalAmountGTQ)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-2xs text-zinc-500 dark:text-zinc-400">
                  <span className="truncate pr-2 text-3xs">
                    {seg.shortDescription}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      {seg.percentageShare}%
                    </span>
                    <span className="text-zinc-400">·</span>
                    <span>
                      {seg.transactionCount}{" "}
                      {seg.transactionCount === 1 ? "compra" : "compras"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
