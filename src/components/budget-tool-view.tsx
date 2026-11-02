"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
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
  generateRealisticBudgetFromTransactions,
  computeHistoricalMonthlyCategoryAverages,
  roundToCleanQuetzales,
  applyBudgetUpdate,
  getBudgetForMonth,
  compareMonthAgainstBudget,
  formatMonthSpanish,
  calculateBudgetFunStats,
  generateNextMonthSuggestions,
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

  const userSwitchedTabRef = useRef(false);
  useEffect(() => {
    if (isBudgetActive && !userSwitchedTabRef.current) {
      setActiveTab("comparativa");
    }
  }, [isBudgetActive]);

  useEffect(() => {
    if (currentBudget?.createdMode) {
      setCreationMode(currentBudget.createdMode);
    }
  }, [currentBudget?.createdMode]);

  // Scope confirmation modal state
  const [showUpdateScopeModal, setShowUpdateScopeModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<BudgetPlan | null>(null);

  // Available chronological months from transactions and existing budget snapshots
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    if (transactions) {
      for (const t of transactions) {
        if (t.date && t.date.length >= 7) {
          set.add(t.date.substring(0, 7));
        }
      }
    }
    if (budgetState?.monthlyBudgets) {
      for (const k of Object.keys(budgetState.monthlyBudgets)) {
        set.add(k);
      }
    }
    return Array.from(set).sort();
  }, [transactions, budgetState]);

  // Selected month for comparison view
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    if (availableMonths.length > 0) return availableMonths[availableMonths.length - 1];
    return new Date().toISOString().substring(0, 7);
  });

  // Keep selectedMonthKey synchronized when availableMonths updates
  useEffect(() => {
    if (availableMonths.length > 0 && (!selectedMonthKey || !availableMonths.includes(selectedMonthKey))) {
      setSelectedMonthKey(availableMonths[availableMonths.length - 1]);
    }
  }, [availableMonths, selectedMonthKey]);

  // Dynamically resolve month budget via getBudgetForMonth
  const monthBudgetPlan = useMemo(() => {
    if (!selectedMonthKey) return currentBudget;
    return getBudgetForMonth(budgetState, selectedMonthKey) || currentBudget;
  }, [budgetState, selectedMonthKey, currentBudget]);

  // Compute month budget vs actual comparison
  const monthComparison = useMemo(() => {
    if (!transactions || transactions.length === 0 || !selectedMonthKey || !monthBudgetPlan) {
      return null;
    }
    return compareMonthAgainstBudget(transactions, selectedMonthKey, monthBudgetPlan);
  }, [transactions, selectedMonthKey, monthBudgetPlan]);

  // Compute gamified performance fun stats (US-060)
  const funStats = useMemo(() => {
    if (!transactions || transactions.length === 0 || !budgetState?.currentBudget) {
      return null;
    }
    return calculateBudgetFunStats(transactions, budgetState, selectedMonthKey);
  }, [transactions, budgetState, selectedMonthKey]);

  // Compute next month improvement suggestions & coaching insights (US-061 / US-062)
  const nextMonthSuggestions = useMemo(() => {
    if (!transactions || transactions.length === 0 || !budgetState?.currentBudget) {
      return [];
    }
    return generateNextMonthSuggestions(transactions, budgetState, selectedMonthKey);
  }, [transactions, budgetState, selectedMonthKey]);

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

  // Historical category averages from transactions
  const historicalAverages = useMemo(() => {
    if (!transactions || transactions.length === 0) return {};
    return computeHistoricalMonthlyCategoryAverages(transactions);
  }, [transactions]);

  // When switching modes, auto-generate realistic targets if switching to transactions mode
  const handleSelectMode = (mode: "zero" | "transactions") => {
    setCreationMode(mode);
    if (mode === "transactions" && hasTransactions) {
      const generated = generateRealisticBudgetFromTransactions(transactions!, customCategories);
      const map = new Map<string, CategoryBudgetTarget>();
      for (const t of generated.targets) {
        map.set(t.categoryName.toLowerCase(), { ...t });
      }
      setTargetsMap(map);
    }
  };

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

  // Edit budget from overview
  const handleEditBudget = () => {
    if (currentBudget?.targets) {
      const map = new Map<string, CategoryBudgetTarget>();
      for (const t of currentBudget.targets) {
        map.set(t.categoryName.toLowerCase(), { ...t });
      }
      setTargetsMap(map);
      if (currentBudget.createdMode) {
        setCreationMode(currentBudget.createdMode);
      }
    }
    userSwitchedTabRef.current = true;
    setActiveTab("configurar");
  };

  // Initiate saving budget plan: if previous budget exists or multiple historical months exist, prompt for scope
  const handleInitiateSave = () => {
    if (targetsList.length === 0) return;

    const newPlan: BudgetPlan = {
      id: currentBudget?.id || `budget-${Date.now()}`,
      name: currentBudget?.name || "Mi Presupuesto Mensual",
      targets: targetsList,
      totalMonthlyBudgetGTQ: totalBudgetGTQ,
      createdMode: creationMode,
      updatedAt: new Date().toISOString(),
    };

    setPendingPlan(newPlan);

    // If an existing budget was already configured and user is editing it, prompt for scope
    if (isBudgetActive) {
      setShowUpdateScopeModal(true);
    } else {
      const newState = applyBudgetUpdate(
        budgetState || { currentBudget: null, monthlyBudgets: {} },
        newPlan,
        "all_months",
        availableMonths
      );
      onSaveBudgetState(newState);
      setActiveTab("comparativa");
    }
  };

  const handleConfirmScope = (scope: "all_months" | "from_now_on") => {
    if (!pendingPlan) return;
    const newState = applyBudgetUpdate(
      budgetState || { currentBudget: null, monthlyBudgets: {} },
      pendingPlan,
      scope,
      availableMonths
    );
    onSaveBudgetState(newState);
    setShowUpdateScopeModal(false);
    setPendingPlan(null);
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
            title={hasTransactions ? "Volver al Dashboard" : "Volver al Inicio"}
          >
            <Icons.ArrowLeft className="w-3.5 h-3.5" />
            <span>{hasTransactions ? "Volver al Dashboard" : "Volver al Inicio"}</span>
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
            onClick={() => {
              userSwitchedTabRef.current = true;
              setActiveTab("configurar");
            }}
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
            onClick={() => {
              userSwitchedTabRef.current = true;
              setActiveTab("comparativa");
            }}
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
            onClick={() => {
              userSwitchedTabRef.current = true;
              setActiveTab("sugerencias");
            }}
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
                  onClick={() => handleSelectMode("zero")}
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
                    if (hasTransactions) handleSelectMode("transactions");
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
                        Estilo de vida:{" "}
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
                    onClick={handleInitiateSave}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer ${
                      targetsList.length === 0
                        ? "opacity-50 cursor-not-allowed bg-zinc-300 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500"
                    }`}
                  >
                    <Icons.Check className="w-4 h-4" />
                    <span>{isBudgetActive ? "Guardar cambios" : "Guardar presupuesto"}</span>
                  </button>
                </div>
              </section>
            )}

            {/* Generator from Transactions: Realistic Review Screen */}
            {creationMode === "transactions" && (
              <section
                id="builder-from-transactions"
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/80 dark:border-zinc-800/80 pb-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                      Metas realistas sugeridas según tu historial
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Fijamos gastos esenciales en el 100% de tu promedio mensual y gastos de estilo de vida con una optimización alcanzable del 5% al 10%.
                    </p>
                  </div>
                  <button
                    type="button"
                    id="btn-recalculate-realistic-budget"
                    onClick={() => {
                      if (hasTransactions) {
                        const generated = generateRealisticBudgetFromTransactions(
                          transactions!,
                          customCategories
                        );
                        const map = new Map<string, CategoryBudgetTarget>();
                        for (const t of generated.targets) {
                          map.set(t.categoryName.toLowerCase(), { ...t });
                        }
                        setTargetsMap(map);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-300 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Regenerar sugerencias iniciales"
                  >
                    <Icons.RotateCcw className="w-3.5 h-3.5" />
                    <span>Restablecer sugerencias</span>
                  </button>
                </div>

                {/* Target Rows Cards */}
                <div className="space-y-3">
                  {targetsList.map((target) => {
                    const avgData = historicalAverages[target.categoryName];
                    const avg = avgData ? avgData.averageGTQ : target.monthlyLimitGTQ;
                    const diffGTQ = target.monthlyLimitGTQ - avg;
                    const diffPct = avg > 0 ? Math.round((diffGTQ / avg) * 100) : 0;
                    const isEssential = target.isEssential;

                    return (
                      <div
                        key={`realistic-target-${target.categoryName}`}
                        id={`realistic-target-card-${target.categoryId}`}
                        className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xs space-y-3"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          {/* Category Name & Essential Badge */}
                          <div className="space-y-1 min-w-[200px]">
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
                            <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                              Gasto promedio actual:{" "}
                              <strong className="text-zinc-700 dark:text-zinc-300 font-mono">
                                {formatCurrency(avg)}
                              </strong>
                            </p>
                          </div>

                          {/* Suggested Realistic Target & Diff */}
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Diff Badge */}
                            <div className="text-right">
                              <span
                                className={`text-3xs font-semibold px-2 py-1 rounded-md border font-mono ${
                                  diffGTQ < 0
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                    : diffGTQ > 0
                                    ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                                    : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                                }`}
                              >
                                {diffGTQ === 0
                                  ? "Igual al promedio (100%)"
                                  : diffGTQ < 0
                                  ? `Ahorro ${formatCurrency(Math.abs(diffGTQ))} (${diffPct}%)`
                                  : `+${formatCurrency(diffGTQ)} (+${diffPct}%)`}
                              </span>
                            </div>

                            {/* Fine-tune Controls */}
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
                          </div>
                        </div>

                        {/* Interactive Adjustment Chips: Igualar a mi promedio, -5%, -10% */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                          <span className="text-3xs font-medium text-zinc-400 uppercase tracking-wider mr-1">
                            Ajustes rápidos:
                          </span>
                          <button
                            type="button"
                            id={`chip-match-avg-${target.categoryId}`}
                            onClick={() => handleUpdateLimit(target.categoryName, avg)}
                            className="px-2 py-0.5 text-3xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                          >
                            Igualar a mi promedio (Q {avg.toLocaleString("es-GT")})
                          </button>
                          <button
                            type="button"
                            id={`chip-cut-5-${target.categoryId}`}
                            onClick={() =>
                              handleUpdateLimit(
                                target.categoryName,
                                roundToCleanQuetzales(avg * 0.95)
                              )
                            }
                            className="px-2 py-0.5 text-3xs font-medium rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                          >
                            -5% (Q {roundToCleanQuetzales(avg * 0.95).toLocaleString("es-GT")})
                          </button>
                          <button
                            type="button"
                            id={`chip-cut-10-${target.categoryId}`}
                            onClick={() =>
                              handleUpdateLimit(
                                target.categoryName,
                                roundToCleanQuetzales(avg * 0.9)
                              )
                            }
                            className="px-2 py-0.5 text-3xs font-medium rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                          >
                            -10% (Q {roundToCleanQuetzales(avg * 0.9).toLocaleString("es-GT")})
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live Summary Bar & Confirm Action */}
                <div
                  id="budget-realistic-summary-bar"
                  className="p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">
                        Meta mensual realista sugerida
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span
                        id="total-budgeted-realistic-display"
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
                        Estilo de vida:{" "}
                        <strong className="text-amber-800 dark:text-amber-400">
                          {formatCurrency(discretionaryTotalGTQ)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    id="btn-confirm-save-budget-from-txs"
                    disabled={targetsList.length === 0}
                    onClick={handleInitiateSave}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    <Icons.Check className="w-4 h-4" />
                    <span>{isBudgetActive ? "Guardar cambios" : "Confirmar y guardar presupuesto"}</span>
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === "comparativa" && (
          <section id="section-comparativa-presupuesto" className="space-y-6">
            {!currentBudget ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center space-y-4 shadow-xs">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
                  <Icons.Sliders className="w-6 h-6" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Aún no has configurado tu presupuesto
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Define tus metas mensuales por categoría para ver la comparativa en tiempo real de tus gastos y ahorros.
                  </p>
                </div>
                <button
                  type="button"
                  id="btn-create-budget-empty"
                  onClick={() => setActiveTab("configurar")}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
                >
                  <Icons.Sliders className="w-4 h-4" />
                  <span>Configurar mi presupuesto</span>
                </button>
              </div>
            ) : (
              <>
                {/* Header Card with Budget Info and Edit Button */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      Comparativa Mensual y Metas
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Presupuesto activo de{" "}
                      <strong className="text-zinc-800 dark:text-zinc-200">
                        {formatCurrency(monthBudgetPlan?.totalMonthlyBudgetGTQ || currentBudget.totalMonthlyBudgetGTQ)}
                      </strong>{" "}
                      con {(monthBudgetPlan?.targets || currentBudget.targets).length} categorías asignadas.
                    </p>
                  </div>

                  <button
                    type="button"
                    id="btn-edit-budget-overview"
                    onClick={handleEditBudget}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:text-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer shrink-0"
                  >
                    <Icons.Pencil className="w-3.5 h-3.5" />
                    <span>Editar presupuesto</span>
                  </button>
                </div>

                {/* Month Selector Bar (US-059) */}
                {availableMonths.length > 0 && (
                  <div
                    id="month-selector-bar"
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-1 shrink-0">
                        <Icons.Calendar className="w-3.5 h-3.5" />
                        <span>Mes evaluado:</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {availableMonths.map((m) => {
                          const isSelected = m === selectedMonthKey;
                          return (
                            <button
                              key={`month-pill-${m}`}
                              id={`month-selector-pill-${m}`}
                              type="button"
                              onClick={() => setSelectedMonthKey(m)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                                isSelected
                                  ? "bg-indigo-600 text-white font-semibold shadow-2xs"
                                  : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                              }`}
                            >
                              {formatMonthSpanish(m)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty State when no transactions uploaded yet */}
                {!hasTransactions ? (
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center space-y-3 shadow-xs">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 mx-auto flex items-center justify-center">
                        <Icons.Upload className="w-5 h-5" />
                      </div>
                      <div className="max-w-md mx-auto space-y-1">
                        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          Carga movimientos para ver tu comparativa
                        </h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          Sube un estado de cuenta en PDF o una lista de gastos para comparar automáticamente lo que gastaste contra las metas de este mes.
                        </p>
                      </div>
                    </div>

                    {currentBudget?.targets && currentBudget.targets.length > 0 && (
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            Metas mensuales configuradas ({currentBudget.targets.length} categorías)
                          </h3>
                          <span className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            Total presupuestado: {formatCurrency(currentBudget.totalMonthlyBudgetGTQ)}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {currentBudget.targets.map((target) => (
                            <div
                              key={`configured-target-${target.categoryId}`}
                              className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
                                  {target.categoryName}
                                </span>
                                <span
                                  className={`text-3xs font-medium px-2 py-0.5 rounded-full border inline-block ${
                                    target.isEssential
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                      : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                                  }`}
                                >
                                  {target.isEssential ? "Esencial" : "Estilo de vida"}
                                </span>
                              </div>
                              <span className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 shrink-0">
                                {formatCurrency(target.monthlyLimitGTQ)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : monthComparison ? (
                  <>
                    {/* Gamified Fun Stats Row (US-060) */}
                    {funStats && (
                      <div
                        id="gamified-fun-stats-row"
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
                      >
                        {/* Card 1: Racha semanal */}
                        <div
                          id="card-stat-weekly-streak"
                          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-2 flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-2xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                              Racha semanal
                            </span>
                            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center">
                              <Icons.Flame className="w-4 h-4" />
                            </div>
                          </div>
                          <div>
                            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                              {funStats.semanasEnRacha.currentStreak}{" "}
                              <span className="text-xs font-sans font-medium text-zinc-500 dark:text-zinc-400">
                                {funStats.semanasEnRacha.currentStreak === 1 ? "semana" : "semanas"}
                              </span>
                            </div>
                            <p className="text-2xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                              {funStats.semanasEnRacha.currentStreak > 0
                                ? "seguidas dentro del presupuesto"
                                : "Comienza una racha esta semana"}
                            </p>
                          </div>
                          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-3xs text-zinc-400">
                            <span>Mejor racha lograda:</span>
                            <strong className="text-zinc-700 dark:text-zinc-300 font-mono">
                              {funStats.semanasEnRacha.bestStreak} {funStats.semanasEnRacha.bestStreak === 1 ? "sem." : "sem."}
                            </strong>
                          </div>
                        </div>

                        {/* Card 2: Metas por categoría */}
                        <div
                          id="card-stat-category-goals"
                          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-2 flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-2xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                              Metas por categoría
                            </span>
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center">
                              <Icons.Award className="w-4 h-4" />
                            </div>
                          </div>
                          <div>
                            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                              {funStats.categoriasCumplidas.metCount}{" "}
                              <span className="text-xs font-sans font-medium text-zinc-500 dark:text-zinc-400">
                                de {funStats.categoriasCumplidas.totalBudgetedCount}
                              </span>
                            </div>
                            <p className="text-2xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                              categorías en meta este mes
                            </p>
                          </div>
                          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-3xs text-zinc-400">
                            <span>Cumplimiento:</span>
                            <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                              {funStats.categoriasCumplidas.totalBudgetedCount > 0
                                ? Math.round(
                                    (funStats.categoriasCumplidas.metCount /
                                      funStats.categoriasCumplidas.totalBudgetedCount) *
                                      100
                                  )
                                : 0}
                              %
                            </strong>
                          </div>
                        </div>

                        {/* Card 3: Mejor categoría / Ahorro */}
                        <div
                          id="card-stat-best-category"
                          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-2 flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-2xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                              Mayor ahorro
                            </span>
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500 flex items-center justify-center">
                              <Icons.TrendingUp className="w-4 h-4" />
                            </div>
                          </div>
                          <div>
                            <div className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                              {funStats.mejorCategoria ? funStats.mejorCategoria.categoryName : "Sin ahorro aún"}
                            </div>
                            <p className="text-2xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">
                              {funStats.mejorCategoria
                                ? `+${formatCurrency(funStats.mejorCategoria.savedAmountGTQ)} bajo meta`
                                : "Superaste tus metas este mes"}
                            </p>
                          </div>
                          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-3xs text-zinc-400">
                            <span>Margen:</span>
                            <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                              {funStats.mejorCategoria ? `${funStats.mejorCategoria.savedPercent}%` : "0%"}
                            </strong>
                          </div>
                        </div>

                        {/* Card 4: Meses dentro de presupuesto */}
                        <div
                          id="card-stat-months-within-budget"
                          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-2 flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-2xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                              Meses en meta
                            </span>
                            <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-500 flex items-center justify-center">
                              <Icons.CheckCircle2 className="w-4 h-4" />
                            </div>
                          </div>
                          <div>
                            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                              {funStats.mesesDentroDePresupuesto.metCount}{" "}
                              <span className="text-xs font-sans font-medium text-zinc-500 dark:text-zinc-400">
                                de {funStats.mesesDentroDePresupuesto.totalMonthsCount}
                              </span>
                            </div>
                            <p className="text-2xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                              meses dentro de tu presupuesto general
                            </p>
                          </div>
                          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-3xs text-zinc-400">
                            <span>Historial evaluado:</span>
                            <strong className="text-teal-600 dark:text-teal-400 font-mono">
                              {funStats.mesesDentroDePresupuesto.totalMonthsCount > 0
                                ? Math.round(
                                    (funStats.mesesDentroDePresupuesto.metCount /
                                      funStats.mesesDentroDePresupuesto.totalMonthsCount) *
                                      100
                                  )
                                : 0}
                              %
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* High-level Monthly Summary Card (US-059) */}
                    <div
                      id="card-monthly-budget-summary"
                      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Resumen General — {formatMonthSpanish(selectedMonthKey)}
                        </span>
                        <span
                          className={`text-2xs font-semibold px-2 py-0.5 rounded-full border ${
                            monthComparison.utilizationPercent <= 90
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                              : monthComparison.utilizationPercent <= 100
                              ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                          }`}
                        >
                          {Math.round(monthComparison.utilizationPercent)}% del presupuesto utilizado
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Presupuesto del Mes */}
                        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-1">
                          <span className="text-2xs font-medium text-zinc-500 dark:text-zinc-400">
                            Presupuesto del Mes (Q)
                          </span>
                          <p
                            id="summary-total-budgeted"
                            className="text-lg sm:text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100"
                          >
                            {formatCurrency(monthComparison.totalBudgetedGTQ)}
                          </p>
                        </div>

                        {/* Gasto Real */}
                        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-1">
                          <span className="text-2xs font-medium text-zinc-500 dark:text-zinc-400">
                            Gasto Real (Q)
                          </span>
                          <p
                            id="summary-total-spent"
                            className="text-lg sm:text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100"
                          >
                            {formatCurrency(monthComparison.totalSpentGTQ)}
                          </p>
                        </div>

                        {/* Net Difference */}
                        <div
                          className={`p-4 rounded-xl border space-y-1 ${
                            monthComparison.remainingGTQ >= 0
                              ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-100"
                              : "bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-100"
                          }`}
                        >
                          <span className="text-2xs font-medium text-zinc-600 dark:text-zinc-400">
                            {monthComparison.remainingGTQ >= 0
                              ? "Ahorro bajo presupuesto"
                              : "Exceso sobre presupuesto"}
                          </span>
                          <p
                            id="summary-net-difference"
                            className={`text-lg sm:text-xl font-bold font-mono ${
                              monthComparison.remainingGTQ >= 0
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-rose-700 dark:text-rose-400"
                            }`}
                          >
                            {formatCurrency(Math.abs(monthComparison.remainingGTQ))}
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar (US-059) */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-2xs text-zinc-500 dark:text-zinc-400">
                          <span>Progreso de utilización mensual</span>
                          <span className="font-mono font-semibold">
                            {formatCurrency(monthComparison.totalSpentGTQ)} / {formatCurrency(monthComparison.totalBudgetedGTQ)}
                          </span>
                        </div>
                        <div
                          id="monthly-budget-progress-bar"
                          className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"
                        >
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              monthComparison.utilizationPercent <= 90
                                ? "bg-emerald-500"
                                : monthComparison.utilizationPercent <= 100
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(0, monthComparison.utilizationPercent))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Category-by-Category Comparison List (US-059) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            Detalle por Categoría
                          </h3>
                          <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                            Cumplimiento de metas asignadas en {formatMonthSpanish(selectedMonthKey)}
                          </p>
                        </div>
                        <span className="text-3xs font-medium text-zinc-500 dark:text-zinc-400">
                          {monthComparison.categoryComparisons.length} categorías presupuestadas
                        </span>
                      </div>

                      <div id="category-comparison-list" className="space-y-3">
                        {monthComparison.categoryComparisons.map((cat) => {
                          const statusColors = {
                            under: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
                            near: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
                            over: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
                            way_over: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-700 font-bold",
                          };

                          const statusLabels = {
                            under: "Dentro de meta",
                            near: "Cerca del límite",
                            over: "Exceso",
                            way_over: "Exceso elevado (+25%)",
                          };

                          const barColors = {
                            under: "bg-emerald-500",
                            near: "bg-amber-500",
                            over: "bg-rose-500",
                            way_over: "bg-rose-600",
                          };

                          return (
                            <div
                              key={`comparison-${cat.categoryId}`}
                              id={`category-comparison-card-${cat.categoryId}`}
                              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-2xs space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                    {cat.categoryName}
                                  </span>
                                  <span
                                    className={`text-3xs font-medium px-2 py-0.5 rounded-full border ${
                                      cat.isEssential
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                        : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                                    }`}
                                  >
                                    {cat.isEssential ? "Esencial" : "Estilo de vida"}
                                  </span>
                                  <span
                                    className={`text-3xs font-semibold px-2 py-0.5 rounded-full border ${
                                      statusColors[cat.status]
                                    }`}
                                  >
                                    {statusLabels[cat.status]}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 text-xs font-mono">
                                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                    {formatCurrency(cat.actualGTQ)}
                                  </span>
                                  <span className="text-zinc-400">/</span>
                                  <span className="text-zinc-500 dark:text-zinc-400">
                                    {formatCurrency(cat.budgetedGTQ)}
                                  </span>
                                  <span className="text-3xs font-semibold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                    {Math.round(cat.utilizationPercent)}%
                                  </span>
                                </div>
                              </div>

                              {/* Progress bar and remaining indicator */}
                              <div className="space-y-1">
                                <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      barColors[cat.status]
                                    }`}
                                    style={{
                                      width: `${Math.min(100, Math.max(0, cat.utilizationPercent))}%`,
                                    }}
                                  />
                                </div>
                                <div className="flex justify-between items-center text-2xs">
                                  <span className="text-zinc-400">
                                    Meta: {formatCurrency(cat.budgetedGTQ)}
                                  </span>
                                  <span
                                    className={`font-semibold ${
                                      cat.remainingGTQ >= 0
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-rose-600 dark:text-rose-400"
                                    }`}
                                  >
                                    {cat.remainingGTQ >= 0
                                      ? `Disponible: ${formatCurrency(cat.remainingGTQ)}`
                                      : `Exceso: ${formatCurrency(Math.abs(cat.remainingGTQ))}`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Unbudgeted Categories Warning Card (US-059) */}
                    {monthComparison.unbudgetedCategories.length > 0 && (
                      <div
                        id="card-unbudgeted-warning"
                        className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-5 shadow-xs space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                            <Icons.AlertCircle className="w-4 h-4" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                              Gastos en categorías fuera de presupuesto
                            </h4>
                            <p className="text-2xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                              En este mes se registraron gastos en categorías que no están contempladas en tu presupuesto activo.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {monthComparison.unbudgetedCategories.map((unb) => (
                            <span
                              key={`unbudgeted-${unb.categoryName}`}
                              className="text-2xs font-medium px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-amber-200/80 dark:border-amber-800/60 text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5"
                            >
                              <span>{unb.categoryName}:</span>
                              <strong className="font-mono text-amber-800 dark:text-amber-300">
                                {formatCurrency(unb.actualGTQ)}
                              </strong>
                            </span>
                          ))}
                        </div>

                        <div className="pt-1">
                          <button
                            type="button"
                            id="btn-add-unbudgeted-to-plan"
                            onClick={handleEditBudget}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
                          >
                            <Icons.Plus className="w-3.5 h-3.5" />
                            <span>Agregar categorías a mi presupuesto</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </>
            )}
          </section>
        )}

        {activeTab === "sugerencias" && (
          <section id="section-sugerencias-presupuesto" className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Sugerencias para el Próximo Mes
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Recomendaciones personalizadas basadas en el análisis de tus hábitos de gasto en{" "}
                  <strong className="text-zinc-800 dark:text-zinc-200">{formatMonthSpanish(selectedMonthKey)}</strong>.
                </p>
              </div>

              {availableMonths.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <span className="text-3xs font-medium text-zinc-500 dark:text-zinc-400 mr-1">
                    Mes:
                  </span>
                  {availableMonths.map((m) => (
                    <button
                      key={`sug-month-${m}`}
                      type="button"
                      onClick={() => setSelectedMonthKey(m)}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-medium transition-colors cursor-pointer shrink-0 ${
                        m === selectedMonthKey
                          ? "bg-indigo-600 text-white font-semibold shadow-2xs"
                          : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      {formatMonthSpanish(m)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Empty state when no transactions exist */}
            {!hasTransactions ? (
              <div
                id="suggestions-empty-state"
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center space-y-3 shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 mx-auto flex items-center justify-center">
                  <Icons.Lightbulb className="w-5 h-5" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Carga movimientos para ver recomendaciones
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Una vez que cargues tus estados de cuenta o una lista de gastos, el motor analizará tus patrones localmente para identificar causas de exceso y reconocer tus avances mensuales.
                  </p>
                </div>
              </div>
            ) : nextMonthSuggestions.length === 0 ? (
              <div
                id="suggestions-all-good-state"
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center space-y-3 shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <Icons.CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    ¡Todo en orden este mes!
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Tus gastos se mantuvieron dentro de las metas planificadas y no se detectaron desviaciones significativas.
                  </p>
                </div>
              </div>
            ) : (
              <div id="next-month-suggestions-list" className="space-y-4">
                {nextMonthSuggestions.map((sug) => {
                  if (sug.type === "over_budget_cause") {
                    return (
                      <div
                        key={sug.id}
                        id={`suggestion-card-over-${sug.categoryName.toLowerCase().replace(/\s+/g, "-")}`}
                        className="bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-100 dark:border-rose-950/60 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 text-3xs font-semibold rounded-full bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                              Alerta de Exceso
                            </span>
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                              {sug.categoryName}
                            </span>
                          </div>
                          {sug.excessAmountGTQ && (
                            <span className="text-2xs font-semibold font-mono text-rose-700 dark:text-rose-400">
                              +{formatCurrency(sug.excessAmountGTQ)} sobre meta
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {sug.title}
                          </h4>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            {sug.description}
                          </p>
                        </div>

                        {/* Actionable recommendation box */}
                        <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60 flex items-start gap-2.5">
                          <Icons.Target className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="text-3xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                              Acción recomendada para el próximo mes
                            </span>
                            <p className="text-xs text-rose-950 dark:text-rose-100">
                              {sug.actionableRecommendation}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (sug.type === "long_term_mastery") {
                    return (
                      <div
                        key={sug.id}
                        id={`suggestion-card-mastery-${sug.categoryName.toLowerCase().replace(/\s+/g, "-")}`}
                        className="bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 dark:border-indigo-950/60 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                              {sug.categoryName}
                            </span>
                          </div>
                          {sug.metrics?.consecutiveMonths && (
                            <span className="text-2xs font-semibold font-mono text-indigo-700 dark:text-indigo-400">
                              {sug.metrics.consecutiveMonths} meses en control
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {sug.title}
                          </h4>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            {sug.description}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 flex items-start gap-2.5">
                          <Icons.Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="text-3xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                              Siguiente objetivo sugerido
                            </span>
                            <p className="text-xs text-indigo-950 dark:text-indigo-100">
                              {sug.actionableRecommendation}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Default: short_term_improvement
                  return (
                    <div
                      key={sug.id}
                      id={`suggestion-card-improvement-${sug.categoryName.toLowerCase().replace(/\s+/g, "-")}`}
                      className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 dark:border-emerald-950/60 pb-3">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {sug.categoryName}
                        </span>
                        {sug.metrics?.previousSpentGTQ !== undefined &&
                          sug.metrics?.currentSpentGTQ !== undefined && (
                            <span className="text-2xs font-semibold font-mono text-emerald-700 dark:text-emerald-400">
                              Ahorro de {formatCurrency(Math.max(0, sug.metrics.previousSpentGTQ - sug.metrics.currentSpentGTQ))}
                            </span>
                          )}
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {sug.title}
                        </h4>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {sug.description}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-start gap-2.5">
                        <Icons.TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <span className="text-3xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                            ¡Mantén el ritmo!
                          </span>
                          <p className="text-xs text-emerald-950 dark:text-emerald-100">
                            {sug.actionableRecommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Confirmation Modal: How to apply budget update (US-058) */}
      {showUpdateScopeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-scope-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            id="modal-budget-scope-confirmation"
            className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-5 sm:p-6 space-y-5"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
                <Icons.Target className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3
                  id="modal-scope-title"
                  className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100"
                >
                  ¿Cómo deseas aplicar los cambios a tu presupuesto?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Tienes datos de meses anteriores. Elige si deseas evaluar todos tus meses cargados con estas nuevas metas o mantener el presupuesto histórico para los meses anteriores.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {/* Option 1: all_months */}
              <button
                type="button"
                id="btn-scope-all-months"
                onClick={() => handleConfirmScope("all_months")}
                className="w-full text-left p-3.5 sm:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-all cursor-pointer group"
              >
                <div>
                  <span className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    Aplicar a meses anteriores y de ahora en adelante
                  </span>
                </div>
                <p className="text-2xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Actualiza el presupuesto en todos los meses cargados para evaluar todo tu historial con las nuevas metas.
                </p>
              </button>

              {/* Option 2: from_now_on */}
              <button
                type="button"
                id="btn-scope-from-now-on"
                onClick={() => handleConfirmScope("from_now_on")}
                className="w-full text-left p-3.5 sm:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-all cursor-pointer group"
              >
                <div>
                  <span className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    Aplicar solo de ahora en adelante
                  </span>
                </div>
                <p className="text-2xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Conserva las metas previas en tus meses anteriores y aplica este nuevo presupuesto a partir de ahora.
                </p>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                id="btn-cancel-scope-modal"
                onClick={() => {
                  setShowUpdateScopeModal(false);
                  setPendingPlan(null);
                }}
                className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
