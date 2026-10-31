"use client";

import React, { useState } from "react";
import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Transaction, CSVParsingSummary, CustomCategory } from "@/types/transaction";
import { StoredBudgetState, BudgetPlan } from "@/types/budget";
import { formatCurrency } from "@/lib/currency";

export type BudgetToolTab = "configurar" | "comparativa" | "sugerencias";

interface BudgetToolViewProps {
  transactions: Transaction[] | null;
  summary: CSVParsingSummary | null;
  customCategories?: CustomCategory[];
  budgetState: StoredBudgetState | null;
  onSaveBudgetState: (state: StoredBudgetState) => void;
  onBack: () => void;
}

export function BudgetToolView({
  transactions,
  summary,
  customCategories = [],
  budgetState,
  onSaveBudgetState,
  onBack,
}: BudgetToolViewProps) {
  const [activeTab, setActiveTab] = useState<BudgetToolTab>("configurar");

  const hasTransactions = Boolean(transactions && transactions.length > 0);
  const currentBudget = budgetState?.currentBudget ?? null;
  const isBudgetActive = Boolean(currentBudget);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="btn-budget-back"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-300 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg transition-colors cursor-pointer"
            title={hasTransactions ? "Volver al Panel" : "Volver al Inicio"}
          >
            <Icons.ArrowLeft className="w-3.5 h-3.5" />
            <span>{hasTransactions ? "Volver al Panel" : "Volver al Inicio"}</span>
          </button>

          <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Icons.Target className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Mi Presupuesto Mensual
                </h1>
                <span
                  id="badge-budget-status"
                  className={`text-3xs font-medium px-2 py-0.5 rounded-full border ${
                    isBudgetActive
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                  }`}
                >
                  {isBudgetActive ? "Presupuesto activo" : "Sin presupuesto configurado"}
                </span>
              </div>
              {currentBudget && (
                <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                  Total presupuestado:{" "}
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {formatCurrency(currentBudget.totalMonthlyBudgetGTQ)}
                  </span>{" "}
                  · {currentBudget.targets.length} categorías
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Navigation Sub-header / Tabs */}
      <nav
        aria-label="Secciones del presupuesto"
        className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-4 sm:px-6 py-1.5 overflow-x-auto"
      >
        <div className="max-w-6xl mx-auto flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            id="tab-configurar-presupuesto"
            onClick={() => setActiveTab("configurar")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0 ${
              activeTab === "configurar"
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold shadow-2xs border border-indigo-200 dark:border-indigo-800/80"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Icons.Sliders className="w-3.5 h-3.5" />
            <span>Configurar Presupuesto</span>
          </button>

          <button
            type="button"
            id="tab-comparativa-presupuesto"
            onClick={() => setActiveTab("comparativa")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0 ${
              activeTab === "comparativa"
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold shadow-2xs border border-indigo-200 dark:border-indigo-800/80"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Icons.BarChart3 className="w-3.5 h-3.5" />
            <span>Comparativa Mensual y Metas</span>
          </button>

          <button
            type="button"
            id="tab-sugerencias-presupuesto"
            onClick={() => setActiveTab("sugerencias")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0 ${
              activeTab === "sugerencias"
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold shadow-2xs border border-indigo-200 dark:border-indigo-800/80"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Icons.Sparkles className="w-3.5 h-3.5" />
            <span>Sugerencias del Próximo Mes</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === "configurar" && (
          <section id="section-configurar-presupuesto" className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Configuración del Presupuesto
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Define tus límites mensuales por categoría para mantener el control de tus finanzas.
              </p>
            </div>
          </section>
        )}

        {activeTab === "comparativa" && (
          <section id="section-comparativa-presupuesto" className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Comparativa Mensual y Metas
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Compara el gasto real contra tu presupuesto establecido para cada mes.
              </p>
            </div>
          </section>
        )}

        {activeTab === "sugerencias" && (
          <section id="section-sugerencias-presupuesto" className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Sugerencias del Próximo Mes
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Recomendaciones personalizadas basadas en el análisis de tus hábitos de gasto.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
