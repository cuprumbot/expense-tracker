"use client";

import React, { useState, useMemo } from "react";
import { Transaction } from "@/types/transaction";
import {
  calculateTransactionAgeSegments,
  TransactionAgeResult,
  TransactionAgeSegment,
  TransactionAgeSegmentId,
} from "@/lib/reporting";
import { formatCurrency } from "@/lib/currency";

interface TransactionAgeChartProps {
  transactions: Transaction[];
  onSelectSegment?: (segment: {
    id: TransactionAgeSegmentId;
    label: string;
    monthKey?: string | null;
    monthLabel?: string | null;
  }) => void;
}

export function TransactionAgeChart({
  transactions,
  onSelectSegment,
}: TransactionAgeChartProps) {
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

  const handleSegmentClick = (segment: TransactionAgeSegment) => {
    const monthObj = availableMonths.find((m) => m.monthKey === selectedMonth);
    onSelectSegment?.({
      id: segment.id,
      label: segment.label,
      monthKey: selectedMonth === "all" ? null : selectedMonth,
      monthLabel: monthObj ? monthObj.monthLabel : null,
    });
  };

  // SVG Donut geometry (enlarged for prominent visual hierarchy)
  const size = 180;
  const strokeWidth = 20;
  const hoverStrokeWidth = 24;
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
    <div className="flex flex-col h-full space-y-2">
      {/* Top Filter Controls */}
      <div className="flex items-center justify-between gap-2 pb-0.5">
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
      <div className="flex-1 min-h-0 flex flex-wrap md:flex-nowrap items-center justify-around gap-2.5 sm:gap-4 overflow-hidden">
        {/* Left: SVG Donut Chart (Bigger display & centered hole) */}
        <div className="flex flex-col items-center justify-center relative py-1 shrink-0">
          <div className="relative w-[135px] h-[135px] sm:w-[155px] sm:h-[155px] flex items-center justify-center">
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
                      tabIndex={0}
                      role="button"
                      aria-label={`${slice.label}: ${formatCurrency(slice.totalAmountGTQ)} (${slice.percentageShare}%)`}
                      className="transition-all duration-200 cursor-pointer origin-center focus:outline-hidden"
                      onClick={() => handleSegmentClick(slice)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSegmentClick(slice);
                        }
                      }}
                      onMouseEnter={() => setHoveredSegment(slice)}
                      onMouseLeave={() => setHoveredSegment(null)}
                      onFocus={() => setHoveredSegment(slice)}
                      onBlur={() => setHoveredSegment(null)}
                    />
                  );
                })}
            </svg>

            {/* Donut Center Display: Constrained strictly to avoid touching the ring */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[100px] max-w-[100px] flex flex-col items-center justify-center text-center px-1">
                <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-400 truncate max-w-[95px]">
                  {hoveredSegment ? hoveredSegment.label : "Total Período"}
                </span>
                <span className="text-xs sm:text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100 my-0.5 truncate max-w-[100px]">
                  {formatCurrency(
                    hoveredSegment
                      ? hoveredSegment.totalAmountGTQ
                      : totalFilteredAmountGTQ
                  )}
                </span>
                <span className="text-[9px] font-mono text-zinc-500 truncate max-w-[95px]">
                  {hoveredSegment
                    ? `${hoveredSegment.percentageShare}% (${hoveredSegment.transactionCount} mov.)`
                    : `${totalFilteredCount} compras`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Legend Breakdown Cards (Clean cards with only title and amount) */}
        <div className="flex-1 min-w-[180px] w-full flex flex-col space-y-1 sm:space-y-1.5 justify-center">
          {segments.map((seg) => {
            const isHovered = hoveredSegment?.id === seg.id;

            return (
              <div
                key={`legend-${seg.id}`}
                id={`legend-segment-${seg.id}`}
                tabIndex={0}
                role="button"
                aria-label={`${seg.label}: ${formatCurrency(seg.totalAmountGTQ)}`}
                onClick={() => handleSegmentClick(seg)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSegmentClick(seg);
                  }
                }}
                onMouseEnter={() => setHoveredSegment(seg)}
                onMouseLeave={() => setHoveredSegment(null)}
                onFocus={() => setHoveredSegment(seg)}
                onBlur={() => setHoveredSegment(null)}
                className={`px-2.5 py-1.5 sm:py-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2.5 focus:outline-hidden focus:ring-1 focus:ring-zinc-400 ${
                  isHovered
                    ? "bg-zinc-50 dark:bg-zinc-900/70 border-zinc-300 dark:border-zinc-700 shadow-2xs"
                    : "bg-white dark:bg-zinc-950 border-zinc-150 dark:border-zinc-850 hover:border-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {seg.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-3xs font-mono font-medium text-zinc-400">
                    ({seg.percentageShare}%)
                  </span>
                  <span className="text-xs sm:text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(seg.totalAmountGTQ)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
