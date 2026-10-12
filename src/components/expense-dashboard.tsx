"use client";

import React from "react";
import { Icons } from "@/components/icons";
import { formatCurrency } from "@/lib/currency";
import { ReportingMetrics, CategoryReportItem } from "@/lib/reporting";
import { SubscriptionSummary } from "@/lib/expense-classifier";
import { CustomCategory } from "@/types/transaction";

interface ExpenseDashboardProps {
  metrics: ReportingMetrics;
  subscriptionSummary: SubscriptionSummary;
  customCategories?: CustomCategory[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onToggleSubscription?: (transactionId: string) => void;
}

const CATEGORY_HEX_COLORS: Record<string, string> = {
  Supermercado: "#10b981", // Emerald
  "Restaurantes y Cafés": "#f59e0b", // Amber
  "Servicios Básicos": "#3b82f6", // Blue
  "Transporte y Combustible": "#f97316", // Orange
  "Salud y Farmacia": "#14b8a6", // Teal
  "Entretenimiento y Compras": "#8b5cf6", // Violet
  Suscripciones: "#6366f1", // Indigo
  Pendiente: "#94a3b8", // Slate
};

export function getCategoryColor(
  categoryName: string,
  customCategories: CustomCategory[] = []
): string {
  if (CATEGORY_HEX_COLORS[categoryName]) {
    return CATEGORY_HEX_COLORS[categoryName];
  }
  const custom = customCategories.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase()
  );
  if (custom?.color) {
    return custom.color;
  }
  return "#64748b";
}

export function ExpenseDashboard({
  metrics,
  subscriptionSummary,
  customCategories = [],
  selectedCategory,
  onSelectCategory,
  onToggleSubscription,
}: ExpenseDashboardProps) {
  const subscriptionPercentage =
    metrics.totalSpend > 0
      ? Math.round(
          (subscriptionSummary.totalMonthlyCommitment / metrics.totalSpend) * 1000
        ) / 10
      : 0;

  // Filter out zero-amount or empty categories
  const activeCategories = metrics.categories.filter((c) => c.total > 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Hero Overview Cards (US-012 & US-013) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Spending KPI Card */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <span className="text-2xs font-semibold tracking-wider text-zinc-500 uppercase">
              Total de gastos del mes
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-50 whitespace-nowrap inline-block">
              {formatCurrency(metrics.totalSpend).replace(" ", "\u00A0")}
            </span>
          </div>

          <p className="mt-2 text-2xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Icons.Calendar className="w-3 h-3 text-zinc-400" />
            <span>
              {metrics.totalTransactionsCount} transacciones analizadas
            </span>
          </p>
        </div>

        {/* Top Spending Category Card */}
        <div
          onClick={() => {
            if (metrics.topCategory) {
              onSelectCategory(
                selectedCategory === metrics.topCategory.category
                  ? "all"
                  : metrics.topCategory.category
              );
            }
          }}
          className={`relative overflow-hidden rounded-2xl border p-5 shadow-xs transition-all cursor-pointer ${
            metrics.topCategory &&
            selectedCategory === metrics.topCategory.category
              ? "border-amber-400 bg-amber-50/30 dark:border-amber-600 dark:bg-amber-950/20 ring-1 ring-amber-400"
              : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          }`}
          title={
            metrics.topCategory
              ? `Haga clic para filtrar por ${metrics.topCategory.category}`
              : undefined
          }
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xs font-semibold tracking-wider text-zinc-500 uppercase">
              Mayor rubro de gasto
            </span>
            {metrics.topCategory && (
              <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 shrink-0 whitespace-nowrap">
                {metrics.topCategory.percentage}% del total
              </span>
            )}
          </div>

          {metrics.topCategory ? (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-50 whitespace-nowrap inline-block">
                  {formatCurrency(metrics.topCategory.total).replace(" ", "\u00A0")}
                </span>
              </div>

              <div className="mt-1.5 flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: getCategoryColor(
                      metrics.topCategory.category,
                      customCategories
                    ),
                  }}
                />
                <span className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 leading-tight">
                  {metrics.topCategory.category}
                </span>
              </div>

              <p className="mt-1 text-2xs text-zinc-500 dark:text-zinc-400">
                {metrics.topCategory.count} {metrics.topCategory.count === 1 ? "movimiento" : "movimientos"} · Clic para filtrar
              </p>
            </>
          ) : (
            <p className="mt-3 text-xs text-zinc-400">Sin datos disponibles</p>
          )}
        </div>

        {/* Subscriptions Spending Overview Card */}
        <div
          onClick={() => {
            onSelectCategory(
              selectedCategory === "Suscripciones" ? "all" : "Suscripciones"
            );
          }}
          className={`relative overflow-hidden rounded-2xl border p-5 shadow-xs transition-all cursor-pointer ${
            selectedCategory === "Suscripciones"
              ? "border-indigo-400 bg-indigo-50/40 dark:border-indigo-600 dark:bg-indigo-950/20 ring-1 ring-indigo-400"
              : "border-indigo-200/90 bg-indigo-50/20 hover:border-indigo-300 dark:border-indigo-900/60 dark:bg-indigo-950/10 dark:hover:border-indigo-800"
          }`}
          title="Haga clic para filtrar gastos de suscripciones"
        >
          <div className="flex items-center gap-2">
            <span className="text-2xs font-semibold tracking-wider text-indigo-900/70 dark:text-indigo-300/80 uppercase">
              Suscripciones
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/70 dark:text-indigo-300 shrink-0">
              <Icons.CreditCard className="w-3 h-3" />
              <span>
                {subscriptionSummary.count}{" "}
                {subscriptionSummary.count === 1 ? "servicio" : "servicios"}
              </span>
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-indigo-950 dark:text-indigo-100 whitespace-nowrap inline-block">
              {formatCurrency(subscriptionSummary.totalMonthlyCommitment).replace(" ", "\u00A0")}
            </span>
          </div>

          <p className="mt-2 text-2xs text-indigo-900/70 dark:text-indigo-300/70">
            {subscriptionPercentage}% de tu gasto mensual · Clic para filtrar
          </p>
        </div>
      </div>

      {/* Visual Category Distribution Bar & Breakdown (US-012) */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
              <Icons.BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Distribución del gasto por categoría
              </h3>
              <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                Comparativa porcentual y montos acumulados en Quetzales
              </p>
            </div>
          </div>

          {selectedCategory !== "all" && (
            <button
              type="button"
              onClick={() => onSelectCategory("all")}
              className="text-2xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline cursor-pointer"
            >
              Restablecer filtro (Ver todos)
            </button>
          )}
        </div>

        {/* Proportional Segmented Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-4 rounded-full overflow-hidden flex bg-zinc-100 dark:bg-zinc-800 shadow-inner">
            {activeCategories.map((cat) => {
              const color = getCategoryColor(cat.category, customCategories);
              const isSelected = selectedCategory === cat.category;
              return (
                <div
                  key={`bar-${cat.category}`}
                  onClick={() =>
                    onSelectCategory(
                      isSelected ? "all" : cat.category
                    )
                  }
                  style={{
                    width: `${cat.percentage}%`,
                    backgroundColor: color,
                  }}
                  className={`h-full transition-opacity cursor-pointer ${
                    selectedCategory !== "all" && !isSelected
                      ? "opacity-30 hover:opacity-75"
                      : "opacity-100"
                  }`}
                  title={`${cat.category}: ${formatCurrency(cat.total)} (${cat.percentage}%)`}
                />
              );
            })}
          </div>
        </div>

        {/* Category Breakdown Cards Grid (Max 3 wide, fused with percentage) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {activeCategories.map((cat: CategoryReportItem) => {
            const color = getCategoryColor(cat.category, customCategories);
            const isSelected = selectedCategory === cat.category;

            return (
              <div
                key={`cat-card-${cat.category}`}
                onClick={() =>
                  onSelectCategory(isSelected ? "all" : cat.category)
                }
                style={{
                  borderLeftColor: color,
                  borderLeftWidth: "4px",
                }}
                className={`p-4 rounded-xl border bg-white dark:bg-zinc-900 transition-all cursor-pointer shadow-2xs ${
                  isSelected
                    ? "border-zinc-900 dark:border-zinc-100 ring-2 ring-zinc-900/80 dark:ring-zinc-100/80 bg-zinc-50/70 dark:bg-zinc-800/50"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20"
                }`}
                title={`Haga clic para filtrar por ${cat.category}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {cat.category}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 shrink-0">
                    {cat.percentage}%
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                    {formatCurrency(cat.total).replace(" ", "\u00A0")}
                  </span>
                  <span className="text-2xs text-zinc-500 dark:text-zinc-400 shrink-0">
                    {cat.count} {cat.count === 1 ? "movimiento" : "movimientos"}
                  </span>
                </div>

                {/* Micro progress bar for this category */}
                <div className="mt-2.5 w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(cat.percentage, 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Subscriptions Alert & Recurring Spend Panel (US-013) - Only if count > 0 */}
      {subscriptionSummary.count > 0 && (
        <div className="rounded-2xl border border-indigo-200/90 bg-indigo-50/30 p-5 dark:border-indigo-900/60 dark:bg-indigo-950/20 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center dark:bg-indigo-900/80 dark:text-indigo-300 shrink-0">
                <Icons.CreditCard className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">
                    Suscripciones Detectadas &amp; Gastos Recurrentes
                  </h3>
                  <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 font-medium">
                    {subscriptionSummary.count}{" "}
                    {subscriptionSummary.count === 1 ? "servicio" : "servicios"}
                  </span>
                </div>
                <p className="text-2xs text-indigo-900/70 dark:text-indigo-300/70">
                  Compromiso recurrente detectado en servicios digitales o cuotas fijas
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-2xs text-indigo-900/70 dark:text-indigo-300/70 block">
                Gasto recurrente total:
              </span>
              <span className="text-base font-bold font-mono text-indigo-950 dark:text-indigo-50 whitespace-nowrap">
                {formatCurrency(subscriptionSummary.totalMonthlyCommitment).replace(" ", "\u00A0")}
              </span>
            </div>
          </div>

          {/* Informational reminder badge / callout (US-013 AC) */}
          <div className="p-3 rounded-xl border border-indigo-200/80 bg-white/80 dark:border-indigo-900/50 dark:bg-zinc-900/70 flex items-start gap-2.5">
            <Icons.Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-950/90 dark:text-indigo-200/90 leading-relaxed space-y-0.5">
              <span className="font-semibold block">
                Auditoría mensual de suscripciones:
              </span>
              <p className="text-2xs text-zinc-600 dark:text-zinc-300">
                Revisa si continúas utilizando activamente cada uno de estos servicios. Cancelar plataformas en desuso o suscripciones duplicadas es una forma directa de reducir gastos sin alterar tu rutina. Puedes activar o desactivar la marca recurrente en cualquier transacción.
              </p>
            </div>
          </div>

          {/* Subscriptions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {subscriptionSummary.services.map((sub) => (
              <div
                key={`sub-panel-${sub.id}-${sub.name}`}
                className="p-3 rounded-xl border border-indigo-200/70 bg-white dark:border-indigo-900/40 dark:bg-zinc-900/90 flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {sub.name}
                    </span>
                    <span className="text-3xs font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800 shrink-0">
                      Recurrente
                    </span>
                  </div>
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
                    className="text-3xs font-medium px-2 py-1 rounded-lg text-zinc-600 hover:text-red-600 bg-zinc-100 hover:bg-red-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-red-950/40 dark:hover:text-red-300 transition-colors shrink-0 cursor-pointer"
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
  );
}
