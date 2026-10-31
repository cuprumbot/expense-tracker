"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Transaction, CSVParsingSummary, CustomCategory } from "@/types/transaction";
import { StoredBudgetState, BudgetPlan, CategoryBudgetTarget } from "@/types/budget";
import { formatCurrency } from "@/lib/currency";
import defaultCatalog from "@/data/merchant-catalog.json";
import {
  isCategoryEssential,
  TIERED_AMOUNT_PRESETS,
  getCategoryHistoricalStats,
} from "@/lib/budget-engine";

export type BudgetToolTab = "configurar" | "comparativa" | "sugerencias";

interface BudgetToolViewProps {
  transactions: Transaction[] | null;
  summary: CSVParsingSummary | null;
  customCategories?: CustomCategory[];
  budgetState: StoredBudgetState | null;
  onSaveBudgetState: (state: StoredBudgetState) => void;
  onBack: () => void;
}

interface AvailableCategoryItem {
  id: string;
  name: string;
  color: string;
  isEssential: boolean;
}

export function BudgetToolView({
  transactions,
  summary,
  customCategories = [],
  budgetState,
  onSaveBudgetState,
  onBack,
}: BudgetToolViewProps) {
  const currentBudget = budgetState?.currentBudget ?? null;
  const isBudgetActive = Boolean(currentBudget);
  const hasTransactions = Boolean(transactions && transactions.length > 0);

  const [activeTab, setActiveTab] = useState<BudgetToolTab>(
    isBudgetActive ? "comparativa" : "configurar"
  );
  const [creationMode, setCreationMode] = useState<"zero" | "transactions">(
    currentBudget?.createdMode || "zero"
  );

  // Active category targets for the builder
  const [targetsMap, setTargetsMap] = useState<Map<string, CategoryBudgetTarget>>(() => {
    const map = new Map<string, CategoryBudgetTarget>();
    if (currentBudget?.targets) {
      for (const t of currentBudget.targets) {
        map.set(t.categoryName.toLowerCase(), { ...t });
      }
    }
    return map;
  });

  // Keep targetsMap in sync if currentBudget changes externally
  useEffect(() => {
    if (currentBudget?.targets && targetsMap.size === 0) {
      const map = new Map<string, CategoryBudgetTarget>();
      for (const t of currentBudget.targets) {
        map.set(t.categoryName.toLowerCase(), { ...t });
      }
      setTargetsMap(map);
    }
  }, [currentBudget]);

  // Merge standard and custom categories
  const allAvailableCategories: AvailableCategoryItem[] = useMemo(() => {
    const standard: AvailableCategoryItem[] = defaultCatalog.categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      isEssential: isCategoryEssential(c.id, c.name),
    }));

    const custom: AvailableCategoryItem[] = customCategories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      isEssential: isCategoryEssential(c.id, c.name),
    }));

    const seen = new Set<string>();
    const merged: AvailableCategoryItem[] = [];
    for (const cat of [...standard, ...custom]) {
      const key = cat.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(cat);
      }
    }
    return merged;
  }, [customCategories]);

  // Group categories by priority
  const essentialCategories = useMemo(
    () => allAvailableCategories.filter((c) => c.isEssential),
    [allAvailableCategories]
  );
  const discretionaryCategories = useMemo(
    () => allAvailableCategories.filter((c) => !c.isEssential),
    [allAvailableCategories]
  );

  // Compute live budget summary metrics
  const targetsList = useMemo(() => Array.from(targetsMap.values()), [targetsMap]);
  const totalBudgetGTQ = useMemo(
    () => targetsList.reduce((sum, t) => sum + (Number(t.monthlyLimitGTQ) || 0), 0),
    [targetsList]
  );
  const essentialTotalGTQ = useMemo(
    () =>
      targetsList
        .filter((t) => t.isEssential)
        .reduce((sum, t) => sum + (Number(t.monthlyLimitGTQ) || 0), 0),
    [targetsList]
  );
  const discretionaryTotalGTQ = useMemo(
    () =>
      targetsList
        .filter((t) => !t.isEssential)
        .reduce((sum, t) => sum + (Number(t.monthlyLimitGTQ) || 0), 0),
    [targetsList]
  );

  // Toggle category in budget builder
  const handleToggleCategory = (cat: AvailableCategoryItem) => {
    setTargetsMap((prev) => {
      const next = new Map(prev);
      const key = cat.name.toLowerCase();
      if (next.has(key)) {
        next.delete(key);
      } else {
        const defaultAmount = cat.isEssential ? 2000 : 300;
        next.set(key, {
          categoryId: cat.id,
          categoryName: cat.name,
          monthlyLimitGTQ: defaultAmount,
          isEssential: cat.isEssential,
        });
      }
      return next;
    });
  };

  // Update target amount for a category
  const handleUpdateLimit = (catName: string, amount: number) => {
    setTargetsMap((prev) => {
      const next = new Map(prev);
      const key = catName.toLowerCase();
      const existing = next.get(key);
      if (existing) {
        next.set(key, {
          ...existing,
          monthlyLimitGTQ: Math.max(0, Math.round(amount)),
        });
      }
      return next;
    });
  };

  // Quick action: add main categories
  const handleAddMainCategories = () => {
    const mainNames = [
      { name: "Supermercado", defaultLimit: 2500, essential: true, id: "supermercado" },
      { name: "Servicios Básicos", defaultLimit: 800, essential: true, id: "servicios" },
      { name: "Transporte y Combustible", defaultLimit: 1000, essential: true, id: "transporte" },
      { name: "Restaurantes y Cafés", defaultLimit: 500, essential: false, id: "restaurantes" },
      { name: "Salud y Farmacia", defaultLimit: 400, essential: true, id: "salud" },
      { name: "Suscripciones", defaultLimit: 200, essential: false, id: "suscripciones" },
    ];

    setTargetsMap((prev) => {
      const next = new Map(prev);
      for (const item of mainNames) {
        const key = item.name.toLowerCase();
        if (!next.has(key)) {
          next.set(key, {
            categoryId: item.id,
            categoryName: item.name,
            monthlyLimitGTQ: item.defaultLimit,
            isEssential: item.essential,
          });
        }
      }
      return next;
    });
  };

  // Save budget plan
  const handleSaveBudget = () => {
    if (targetsList.length === 0) return;

    const newPlan: BudgetPlan = {
      id: currentBudget?.id || `budget-${Date.now()}`,
      name: "Mi Presupuesto Mensual",
      targets: targetsList,
      totalMonthlyBudgetGTQ: totalBudgetGTQ,
      createdMode: creationMode,
      updatedAt: new Date().toISOString(),
    };

    const newState: StoredBudgetState = {
      currentBudget: newPlan,
      monthlyBudgets: budgetState?.monthlyBudgets || {},
      effectiveFromMonth: budgetState?.effectiveFromMonth || null,
    };

    onSaveBudgetState(newState);
    setActiveTab("comparativa");
  };

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
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {activeTab === "configurar" && (
          <div className="space-y-6">
            {/* Step 1: Starting Path Selection */}
            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                  ¿Cómo deseas crear tu presupuesto?
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Elige si prefieres definirlo desde cero seleccionando categorías o generarlo a partir de tus gastos.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Option 1: Desde cero */}
                <button
                  type="button"
                  id="btn-mode-from-zero"
                  onClick={() => setCreationMode("zero")}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                    creationMode === "zero"
                      ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/30"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      creationMode === "zero"
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <Icons.Sliders className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs sm:text-sm font-semibold block text-zinc-900 dark:text-zinc-100">
                      Crear presupuesto desde cero
                    </span>
                    <p className="text-2xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Elige tus categorías y asigna montos límite con sugerencias lógicas por prioridad y tu historial.
                    </p>
                  </div>
                </button>

                {/* Option 2: Basado en gastos subidos */}
                <button
                  type="button"
                  id="btn-mode-from-transactions"
                  disabled={!hasTransactions}
                  onClick={() => {
                    if (hasTransactions) setCreationMode("transactions");
                  }}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                    !hasTransactions
                      ? "opacity-60 cursor-not-allowed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50"
                      : creationMode === "transactions"
                      ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/30 cursor-pointer"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 cursor-pointer"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      creationMode === "transactions"
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <Icons.Sparkles className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-semibold block text-zinc-900 dark:text-zinc-100">
                        Generar basado en mis gastos subidos
                      </span>
                      {!hasTransactions && (
                        <span className="text-3xs font-medium px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          Requiere movimientos
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {hasTransactions
                        ? "Calcula promedios mensuales reales y propone metas realistas ajustadas a tu comportamiento."
                        : "Carga estados de cuenta o una lista de gastos para desbloquear la generación automática."}
                    </p>
                  </div>
                </button>
              </div>
            </section>

            {/* Builder from Zero: Category Chips & Tiered Amount Controls */}
            {creationMode === "zero" && (
              <section
                id="builder-from-zero"
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6"
              >
                {/* Header with Quick Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/80 dark:border-zinc-800/80 pb-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                      Selecciona las categorías de tu presupuesto
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Haz clic en las categorías que deseas incluir. Las categorías esenciales tienen sugerencias de mayor monto.
                    </p>
                  </div>
                  <button
                    type="button"
                    id="btn-add-main-categories"
                    onClick={handleAddMainCategories}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/60 dark:border-indigo-800 dark:hover:bg-indigo-900/60 rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs"
                  >
                    <Icons.Plus className="w-3.5 h-3.5" />
                    <span>Agregar categorías principales</span>
                  </button>
                </div>

                {/* Priority Group 1: Gastos Esenciales / Hogar */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                      Gastos Esenciales / Hogar
                    </span>
                    <span className="text-3xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium">
                      Mayor asignación
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {essentialCategories.map((cat) => {
                      const isSelected = targetsMap.has(cat.name.toLowerCase());
                      return (
                        <button
                          key={`cat-pill-${cat.id}`}
                          type="button"
                          id={`chip-cat-${cat.id}`}
                          onClick={() => handleToggleCategory(cat)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20"
                              : "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                          }`}
                        >
                          {isSelected ? (
                            <Icons.Check className="w-3 h-3 text-white" />
                          ) : (
                            <Icons.Plus className="w-3 h-3 text-zinc-400" />
                          )}
                          <span>{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Priority Group 2: Estilo de Vida y Ocio */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                      Estilo de Vida y Ocio
                    </span>
                    <span className="text-3xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium">
                      Discrecional
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {discretionaryCategories.map((cat) => {
                      const isSelected = targetsMap.has(cat.name.toLowerCase());
                      return (
                        <button
                          key={`cat-pill-${cat.id}`}
                          type="button"
                          id={`chip-cat-${cat.id}`}
                          onClick={() => handleToggleCategory(cat)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-500/20"
                              : "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                          }`}
                        >
                          {isSelected ? (
                            <Icons.Check className="w-3 h-3 text-white" />
                          ) : (
                            <Icons.Plus className="w-3 h-3 text-zinc-400" />
                          )}
                          <span>{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target Configuration Cards for Selected Categories */}
                <div className="space-y-4 pt-4 border-t border-zinc-200/80 dark:border-zinc-800/80">
                  <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Metas mensuales por categoría ({targetsList.length} seleccionadas)
                  </h4>

                  {targetsList.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
                      <Icons.Target className="w-8 h-8 text-zinc-400 mx-auto" />
                      <p className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        No has seleccionado ninguna categoría aún
                      </p>
                      <p className="text-2xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                        Haz clic en las categorías arriba o en &quot;Agregar categorías principales&quot; para comenzar.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {targetsList.map((target) => {
                        const isEssential = target.isEssential;
                        const presets = isEssential
                          ? TIERED_AMOUNT_PRESETS.essential
                          : TIERED_AMOUNT_PRESETS.discretionary;
                        const historyStats = hasTransactions
                          ? getCategoryHistoricalStats(transactions!, target.categoryName)
                          : null;

                        return (
                          <div
                            key={`target-card-${target.categoryName}`}
                            id={`target-card-${target.categoryId}`}
                            className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xs space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                  {target.categoryName}
                                </span>
                                <span
                                  className={`text-3xs font-medium px-2 py-0.5 rounded-full border ${
                                    isEssential
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                      : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                                  }`}
                                >
                                  {isEssential ? "Esencial" : "Estilo de vida"}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Increment / Decrement & Input */}
                                <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-zinc-50 dark:bg-zinc-900">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateLimit(target.categoryName, target.monthlyLimitGTQ - 100)
                                    }
                                    className="px-2 py-1 text-2xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer border-r border-zinc-200 dark:border-zinc-700"
                                    title="Restar Q 100"
                                  >
                                    -Q 100
                                  </button>
                                  <div className="flex items-center px-2 py-0.5">
                                    <span className="text-2xs font-mono font-medium text-zinc-400 mr-1">
                                      Q
                                    </span>
                                    <input
                                      type="number"
                                      step="50"
                                      min="0"
                                      value={target.monthlyLimitGTQ}
                                      onChange={(e) =>
                                        handleUpdateLimit(
                                          target.categoryName,
                                          Number(e.target.value) || 0
                                        )
                                      }
                                      className="w-20 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 bg-transparent focus:outline-hidden text-right"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateLimit(target.categoryName, target.monthlyLimitGTQ + 100)
                                    }
                                    className="px-2 py-1 text-2xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer border-l border-zinc-200 dark:border-zinc-700"
                                    title="Sumar Q 100"
                                  >
                                    +Q 100
                                  </button>
                                </div>

                                {/* Remove Button */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleCategory({
                                      id: target.categoryId,
                                      name: target.categoryName,
                                      color: "zinc",
                                      isEssential: Boolean(target.isEssential),
                                    })
                                  }
                                  className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                                  title="Quitar categoría"
                                >
                                  <Icons.Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Preset Amount Chips & Historical Context Chips */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-3xs font-medium text-zinc-400 uppercase tracking-wider mr-1">
                                Sugerencias:
                              </span>

                              {/* Tiered Preset Amount Pills */}
                              {presets.map((preset) => {
                                const isSelected = target.monthlyLimitGTQ === preset;
                                return (
                                  <button
                                    key={`preset-${target.categoryId}-${preset}`}
                                    type="button"
                                    onClick={() => handleUpdateLimit(target.categoryName, preset)}
                                    className={`px-2 py-0.5 text-3xs font-mono font-medium rounded-md border transition-all cursor-pointer ${
                                      isSelected
                                        ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 shadow-2xs"
                                        : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    }`}
                                  >
                                    Q {preset.toLocaleString("es-GT")}
                                  </button>
                                );
                              })}

                              {/* Historical Context Chips */}
                              {historyStats && (
                                <>
                                  <span className="text-zinc-300 dark:text-zinc-700 mx-0.5">·</span>
                                  <button
                                    type="button"
                                    id={`chip-history-avg-${target.categoryId}`}
                                    onClick={() =>
                                      handleUpdateLimit(
                                        target.categoryName,
                                        historyStats.averageMonthlyGTQ
                                      )
                                    }
                                    className="px-2 py-0.5 text-3xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80 hover:bg-blue-100 transition-colors cursor-pointer"
                                    title="Usar promedio histórico mensual"
                                  >
                                    Promedio: Q {historyStats.averageMonthlyGTQ.toLocaleString("es-GT")}
                                  </button>
                                  <button
                                    type="button"
                                    id={`chip-history-last-${target.categoryId}`}
                                    onClick={() =>
                                      handleUpdateLimit(target.categoryName, historyStats.lastMonthGTQ)
                                    }
                                    className="px-2 py-0.5 text-3xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80 hover:bg-blue-100 transition-colors cursor-pointer"
                                    title="Usar gasto del último mes registrado"
                                  >
                                    Último mes: Q {historyStats.lastMonthGTQ.toLocaleString("es-GT")}
                                  </button>
                                  <button
                                    type="button"
                                    id={`chip-history-goal-${target.categoryId}`}
                                    onClick={() =>
                                      handleUpdateLimit(target.categoryName, historyStats.goalMinus10GTQ)
                                    }
                                    className="px-2 py-0.5 text-3xs font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80 hover:bg-emerald-100 transition-colors cursor-pointer"
                                    title="Meta optimizada (-10% del promedio)"
                                  >
                                    Meta -10%: Q {historyStats.goalMinus10GTQ.toLocaleString("es-GT")}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Live Summary Bar & Save Action */}
                <div
                  id="budget-builder-summary-bar"
                  className="p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">
                        Total presupuestado
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span
                        id="total-budgeted-display"
                        className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100"
                      >
                        {formatCurrency(totalBudgetGTQ)}
                      </span>
                      <span className="text-2xs text-zinc-500 dark:text-zinc-400">mensual</span>
                    </div>
                    <div className="flex items-center gap-3 text-2xs text-zinc-500 dark:text-zinc-400">
                      <span>
                        Esenciales:{" "}
                        <strong className="text-emerald-800 dark:text-emerald-400">
                          {formatCurrency(essentialTotalGTQ)}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        Ocio y estilo de vida:{" "}
                        <strong className="text-amber-800 dark:text-amber-400">
                          {formatCurrency(discretionaryTotalGTQ)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    id="btn-save-budget"
                    disabled={targetsList.length === 0}
                    onClick={handleSaveBudget}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer ${
                      targetsList.length === 0
                        ? "opacity-50 cursor-not-allowed bg-zinc-300 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500"
                    }`}
                  >
                    <Icons.Check className="w-4 h-4" />
                    <span>Guardar presupuesto</span>
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === "comparativa" && (
          <section id="section-comparativa-presupuesto" className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Comparativa Mensual y Metas
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {currentBudget
                    ? `Presupuesto activo de ${formatCurrency(currentBudget.totalMonthlyBudgetGTQ)} con ${currentBudget.targets.length} categorías.`
                    : "Configura primero tu presupuesto para ver la comparativa mes a mes."}
                </p>
              </div>

              {currentBudget && (
                <button
                  type="button"
                  id="btn-edit-budget-overview"
                  onClick={() => setActiveTab("configurar")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:text-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
                >
                  <Icons.Pencil className="w-3.5 h-3.5" />
                  <span>Editar presupuesto</span>
                </button>
              )}
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
