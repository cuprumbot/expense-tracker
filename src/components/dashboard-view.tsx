"use client";

import React, { useState } from "react";
import { Icons } from "@/components/icons";
import { Transaction, CSVParsingSummary, CustomCategory } from "@/types/transaction";
import { formatCurrency } from "@/lib/currency";
import { SlidingDrawer } from "@/components/sliding-drawer";
import { CategoryTrendChart } from "@/components/category-trend-chart";
import { VendorConcentrationChart } from "@/components/vendor-concentration-chart";
import { ConsumptionPatternsChart } from "@/components/consumption-patterns-chart";

interface DashboardViewProps {
  transactions: Transaction[];
  summary: CSVParsingSummary | null;
  bankName: string | null;
  customCategories: CustomCategory[];
  onAddMoreStatements: () => void;
  onResetSession: () => void;
  onClearData?: () => void;
  renderDrawerContent: () => React.ReactNode;
}

export function DashboardView({
  transactions,
  summary,
  bankName,
  customCategories,
  onAddMoreStatements,
  onResetSession,
  onClearData,
  renderDrawerContent,
}: DashboardViewProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const totalAmount = summary?.totalAmount ?? transactions.reduce((acc, t) => acc + t.amount, 0);
  const totalCount = transactions.length;
  const pendingCount = transactions.filter(
    (t) => !t.category || t.category === "Pendiente"
  ).length;

  return (
    <div
      id="dashboard-root"
      className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors"
    >
      {/* Top Navigation & Action Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Title & Overview Info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center shrink-0 shadow-xs">
            <Icons.LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Panel de Control Financiero
              </h1>
              {bankName && (
                <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {bankName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-2xs text-zinc-500 dark:text-zinc-400">
              <span>{totalCount} movimientos analizados</span>
              <span>·</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                Total: {formatCurrency(totalAmount)}
              </span>
              {pendingCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {pendingCount} sin clasificar
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Add more bank statements */}
          <button
            type="button"
            id="btn-dashboard-add-statements"
            onClick={onAddMoreStatements}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-800 dark:hover:bg-emerald-900/60 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Añadir más archivos de estado de cuenta"
          >
            <Icons.Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Agregar más estados de cuenta</span>
            <span className="sm:hidden">Agregar</span>
          </button>

          {/* Reset session */}
          <button
            type="button"
            id="btn-dashboard-reset-session"
            onClick={onResetSession}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 border border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
            title="Reiniciar sesión de transacciones"
          >
            <Icons.RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reiniciar sesión</span>
          </button>

          {/* Clear all data (US-011) */}
          {onClearData && (
            <button
              type="button"
              id="btn-dashboard-clear-data"
              onClick={onClearData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
              title="Borrar todos mis datos permanentemente"
            >
              <Icons.Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Borrar mis datos</span>
            </button>
          )}

          {/* Open Sliding Transaction Drawer */}
          <button
            type="button"
            id="btn-toggle-transactions-drawer"
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer shadow-xs"
            title="Abrir panel lateral de transacciones"
          >
            <Icons.Table className="w-3.5 h-3.5" />
            <span>Ver transacciones</span>
            <span className="text-3xs font-mono font-medium px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-100 dark:bg-zinc-300 dark:text-zinc-900">
              {totalCount}
            </span>
          </button>
        </div>
      </header>

      {/* Main 4-Panel 2x2 Responsive Grid */}
      <main className="flex-1 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 auto-rows-fr">
        {/* Panel 1: Tendencia de Gastos por Categoría */}
        <section
          id="panel-category-trends"
          aria-label="Panel 1: Tendencia de Gastos por Categoría"
          className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-850">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Icons.TrendingDown className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-3xs font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Panel 1
                  </span>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Tendencia de Gastos por Categoría
                  </h2>
                </div>
                <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                  Información Básica · Evolución mensual del gasto por categoría.
                </p>
              </div>
            </div>
          </div>

          {/* Panel 1 Body / Interactive Multi-Line SVG Chart */}
          <div className="flex-1 pt-4">
            <CategoryTrendChart
              transactions={transactions}
              customCategories={customCategories}
            />
          </div>
        </section>

        {/* Panel 2: Concentración de Comercios */}
        <section
          id="panel-vendor-concentration"
          aria-label="Panel 2: Concentración de Comercios"
          className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-850">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Icons.Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-3xs font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Panel 2
                  </span>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Concentración de Comercios
                  </h2>
                </div>
                <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                  ¿A dónde se va mi dinero? · Principales comercios por monto y frecuencia.
                </p>
              </div>
            </div>
          </div>

          {/* Panel 2 Body / Interactive Dual-Metric Bar Chart */}
          <div className="flex-1 pt-4">
            <VendorConcentrationChart
              transactions={transactions}
              customCategories={customCategories}
            />
          </div>
        </section>

        {/* Panel 3: Patrones de consumo */}
        <section
          id="panel-consumption-patterns"
          aria-label="Patrones de consumo"
          className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-850">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Patrones de consumo
            </h2>
          </div>

          {/* Panel 3 Body / Consumption Patterns Bar Chart */}
          <div className="flex-1 pt-4">
            <ConsumptionPatternsChart transactions={transactions} />
          </div>
        </section>

        {/* Panel 4: Antigüedad del Gasto */}
        <section
          id="panel-transaction-age"
          aria-label="Panel 4: Antigüedad del Gasto"
          className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-850">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Icons.PieChart className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-3xs font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Panel 4
                  </span>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Antigüedad del Gasto
                  </h2>
                </div>
                <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                  Compromisos vs Compras Inmediatas · Cuotas pasadas, suscripciones y gastos del mes.
                </p>
              </div>
            </div>
          </div>

          {/* Panel 4 Body / Visual Placeholder */}
          <div className="flex-1 py-8 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-400 flex items-center justify-center">
              <Icons.PieChart className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Gráfico de Dona / Pastel de Antigüedad
            </p>
            <p className="text-2xs text-zinc-400 dark:text-zinc-500 max-w-xs">
              Compara qué porción de tus ingresos está comprometida en decisiones pasadas vs consumos nuevos.
            </p>
          </div>
        </section>
      </main>

      {/* Off-canvas Sliding Transaction Drawer */}
      <SlidingDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Detalle de movimientos"
        totalCount={totalCount}
      >
        {renderDrawerContent()}
      </SlidingDrawer>
    </div>
  );
}
