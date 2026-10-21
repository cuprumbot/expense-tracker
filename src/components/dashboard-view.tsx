"use client";

import React, { useState } from "react";
import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Transaction, CSVParsingSummary, CustomCategory } from "@/types/transaction";
import { formatCurrency } from "@/lib/currency";
import { SlidingDrawer } from "@/components/sliding-drawer";
import { CategoryTrendChart } from "@/components/category-trend-chart";
import { VendorConcentrationChart } from "@/components/vendor-concentration-chart";
import { ConsumptionPatternsChart } from "@/components/consumption-patterns-chart";
import { TransactionAgeChart } from "@/components/transaction-age-chart";

interface DashboardViewProps {
  transactions: Transaction[];
  summary: CSVParsingSummary | null;
  bankName: string | null;
  customCategories: CustomCategory[];
  onAddMoreStatements: () => void;
  onResetSession: () => void;
  onClearData?: () => void;
  renderDrawerContent: (categoryFilter?: string | null) => React.ReactNode;
  isClassifyingWithLLM?: boolean;
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
  isClassifyingWithLLM = false,
}: DashboardViewProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerCategoryFilter, setDrawerCategoryFilter] = useState<string | null>(null);

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
      <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-4 sm:px-6 py-1.5 sm:py-2 flex flex-wrap items-center justify-between gap-2.5">
        {/* Title & Overview Info */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center shrink-0 shadow-2xs">
            <Icons.Wallet className="w-3 h-3" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
                Expense Tracker
              </h1>
              {bankName && !bankName.includes("Consolidado multicuenta") && (
                <span className="text-3xs font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {bankName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-2xs text-zinc-500 dark:text-zinc-400 flex-wrap leading-tight">
              <span>{totalCount} movimientos analizados</span>
              <span>·</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                Total: {formatCurrency(totalAmount)}
              </span>

              {isClassifyingWithLLM && (
                <>
                  <span>·</span>
                  <span
                    id="chip-classifying-expenses"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-3xs sm:text-2xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80 shadow-2xs"
                  >
                    <Icons.Sparkles className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>Clasificando con IA...</span>
                  </span>
                </>
              )}

              {!isClassifyingWithLLM && pendingCount > 0 && (
                <>
                  <span>·</span>
                  <button
                    type="button"
                    id="btn-filter-unclassified"
                    onClick={() => {
                      setDrawerCategoryFilter("Pendiente");
                      setIsDrawerOpen(true);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-3xs sm:text-2xs font-medium cursor-pointer transition-all border ${
                      pendingCount > 10
                        ? "bg-amber-100/90 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700 animate-pulse ring-2 ring-amber-400/50 shadow-xs"
                        : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                    }`}
                    title="Ver movimientos sin clasificar"
                  >
                    {pendingCount > 10 && (
                      <Icons.AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    <span>{pendingCount} sin clasificar</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>


        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Dark / Light Theme Toggle */}
          <ThemeToggle />

          {/* Add more bank statements */}
          <button
            type="button"
            id="btn-dashboard-add-statements"
            onClick={onAddMoreStatements}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs sm:text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-800 dark:hover:bg-emerald-900/60 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Añadir más archivos de estado de cuenta"
          >
            <Icons.Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Agregar más estados de cuenta</span>
            <span className="sm:hidden">Agregar</span>
          </button>

          {/* Reset session */}
          <button
            type="button"
            id="btn-dashboard-reset-session"
            onClick={onResetSession}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs sm:text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 border border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
            title="Reiniciar sesión de transacciones"
          >
            <Icons.RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reiniciar sesión</span>
          </button>

          {/* Clear all data (US-011) */}
          {onClearData && (
            <button
              type="button"
              id="btn-dashboard-clear-data"
              onClick={onClearData}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs sm:text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
              title="Borrar todos mis datos permanentemente"
            >
              <Icons.Trash2 className="w-3 h-3" />
              <span className="hidden sm:inline">Borrar mis datos</span>
            </button>
          )}

          {/* Open Sliding Transaction Drawer */}
          <button
            type="button"
            id="btn-toggle-transactions-drawer"
            onClick={() => {
              setDrawerCategoryFilter(null);
              setIsDrawerOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-2xs sm:text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer shadow-xs"
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
      <main className="flex-1 p-3.5 sm:p-4 lg:p-5 grid grid-cols-1 lg:grid-cols-2 gap-3.5 lg:gap-4 auto-rows-fr">
        {/* Panel 1: Histórico por categoría */}
        <section
          id="panel-category-trends"
          aria-label="Histórico por categoría"
          className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-850">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Histórico por categoría
            </h2>
          </div>

          {/* Panel 1 Body / Interactive Multi-Line SVG Chart */}
          <div className="flex-1 pt-2.5 sm:pt-3">
            <CategoryTrendChart
              transactions={transactions}
              customCategories={customCategories}
            />
          </div>
        </section>

        {/* Panel 2: ¿A dónde va mi dinero? */}
        <section
          id="panel-vendor-concentration"
          aria-label="¿A dónde va mi dinero?"
          className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-850">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              ¿A dónde va mi dinero?
            </h2>
          </div>

          {/* Panel 2 Body / Interactive Dual-Metric Bar Chart */}
          <div className="flex-1 pt-2.5 sm:pt-3">
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
          className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-850">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Patrones de consumo
            </h2>
          </div>

          {/* Panel 3 Body / Consumption Patterns Bar Chart */}
          <div className="flex-1 pt-2.5 sm:pt-3">
            <ConsumptionPatternsChart transactions={transactions} />
          </div>
        </section>

        {/* Panel 4: Antigüedad del gasto */}
        <section
          id="panel-transaction-age"
          aria-label="Antigüedad del gasto"
          className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-850">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Antigüedad del gasto
            </h2>
          </div>

          {/* Panel 4 Body / Transaction Age Donut Chart */}
          <div className="flex-1 pt-2.5 sm:pt-3">
            <TransactionAgeChart transactions={transactions} />
          </div>
        </section>
      </main>

      {/* Off-canvas Sliding Transaction Drawer */}
      <SlidingDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setDrawerCategoryFilter(null);
        }}
        title="Detalle de movimientos"
        totalCount={totalCount}
      >
        {renderDrawerContent(drawerCategoryFilter)}
      </SlidingDrawer>
    </div>
  );
}

