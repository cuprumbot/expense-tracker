"use client";

import React, { useState, useEffect } from "react";
import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Transaction, CSVParsingSummary, CustomCategory, DrawerFilter } from "@/types/transaction";
import { formatCurrency } from "@/lib/currency";
import { SlidingDrawer } from "@/components/sliding-drawer";
import { CategoryTrendChart } from "@/components/category-trend-chart";
import { VendorConcentrationChart } from "@/components/vendor-concentration-chart";
import { ConsumptionPatternsChart } from "@/components/consumption-patterns-chart";
import { TransactionAgeChart } from "@/components/transaction-age-chart";
import { TransactionAgeSegmentId } from "@/lib/reporting";
import {
  loadStoredPanelDimensions,
  saveStoredPanelDimensions,
  resetStoredPanelDimensions,
  PanelDimensions,
  DEFAULT_PANEL_DIMENSIONS,
} from "@/lib/storage";

const PANEL_TUTORIALS: Record<string, { title: string; content: string }> = {
  "panel-category-trends": {
    title: "Histórico por categoría",
    content:
      "Clic en una categoría para ocultarla o mostrarla.\n\nClic en un punto para ver transacciones de esa categoría y mes.\n\nClic en una línea para ocultar las demás categorías.",
  },
  "panel-vendor-concentration": {
    title: "¿A dónde va mi dinero?",
    content: "Clic en un negocio para ocultarlo de la lista.",
  },
  "panel-consumption-patterns": {
    title: "Patrones de consumo",
    content: "Clic en un día de la semana o del mes para ver transacciones filtradas.",
  },
  "panel-transaction-age": {
    title: "Antigüedad del gasto",
    content: "Clic en un tipo de gasto para ver transacciones filtradas.",
  },
};

interface DashboardPanelSectionProps {
  id: string;
  title: string;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  isInfoActive: boolean;
  onToggleInfo: () => void;
  isSettingsActive?: boolean;
  onToggleSettings?: () => void;
  tutorialContent: string;
  children: React.ReactNode;
  height?: number;
  onResizeStart?: (e: React.MouseEvent | React.TouchEvent, panelId: string) => void;
  onResetSize?: (panelId: string) => void;
  isResizing?: boolean;
}

function DashboardPanelSection({
  id,
  title,
  isMinimized,
  onToggleMinimize,
  isInfoActive,
  onToggleInfo,
  isSettingsActive,
  onToggleSettings,
  tutorialContent,
  children,
  height,
  onResizeStart,
  onResetSize,
  isResizing = false,
}: DashboardPanelSectionProps) {
  return (
    <section
      id={id}
      aria-label={title}
      style={{
        height: isMinimized ? undefined : height ? `${height}px` : undefined,
      }}
      className={`relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs ${
        isResizing ? "transition-none select-none" : "transition-all duration-200"
      } ${
        isMinimized
          ? "p-2.5 sm:p-3 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
          : "p-3.5 sm:p-4 flex flex-col justify-between overflow-hidden"
      }`}
      onClick={isMinimized ? onToggleMinimize : undefined}
    >
      {isMinimized ? (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <button
            type="button"
            id={`btn-restore-${id}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMinimize();
            }}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
            title="Restaurar panel"
            aria-label={`Restaurar ${title}`}
          >
            <Icons.Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-850 shrink-0">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h2>
            <div className="flex items-center gap-1">
              {onToggleSettings && (
                <button
                  type="button"
                  id={`btn-settings-${id}`}
                  onClick={onToggleSettings}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    isSettingsActive
                      ? "text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400"
                      : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-850"
                  }`}
                  title="Configuración"
                  aria-label={`Configuración de ${title}`}
                >
                  <Icons.Settings className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                id={`btn-info-${id}`}
                onClick={onToggleInfo}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  isInfoActive
                    ? "text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400"
                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-850"
                }`}
                title="Información"
                aria-label={`Información de ${title}`}
              >
                <Icons.Info className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                id={`btn-minimize-${id}`}
                onClick={onToggleMinimize}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
                title="Minimizar panel"
                aria-label={`Minimizar ${title}`}
              >
                <Icons.Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isInfoActive && (
            <div
              role="dialog"
              aria-label={`Información: ${title}`}
              className="p-3 my-2 rounded-xl border border-blue-200 bg-blue-50/90 dark:border-blue-900/60 dark:bg-blue-950/80 text-blue-950 dark:text-blue-100 shadow-2xs animate-in fade-in duration-150 shrink-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Icons.Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed text-blue-900 dark:text-blue-200 whitespace-pre-line">
                    {tutorialContent}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggleInfo}
                  className="p-1 rounded-md text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-100 cursor-pointer"
                  title="Cerrar tutorial"
                  aria-label="Cerrar tutorial"
                >
                  <Icons.X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 pt-2 sm:pt-2.5 min-h-0 flex flex-col overflow-hidden pb-1">
            {children}
          </div>

          {/* Corner Resize Indicator Handle */}
          <div
            id={`resize-handle-${id}`}
            role="separator"
            aria-label={`Redimensionar ${title}`}
            title="Arrastra para redimensionar (horizontal y vertical). Doble clic para restablecer."
            onMouseDown={(e) => onResizeStart?.(e, id)}
            onTouchStart={(e) => onResizeStart?.(e, id)}
            onDoubleClick={() => onResetSize?.(id)}
            className="absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 p-1 rounded cursor-se-resize select-none touch-none text-zinc-350 hover:text-zinc-600 dark:text-zinc-650 dark:hover:text-zinc-300 transition-colors z-20 group"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="10" y1="2" x2="2" y2="10" />
              <line x1="10" y1="6" x2="6" y2="10" />
              <line x1="10" y1="10" x2="10" y2="10" />
            </svg>
          </div>
        </>
      )}
    </section>
  );
}

const VERIFIED_BANKS = new Set([
  "Banco Industrial",
  "Banco Cuscatlán",
  "BAC Credomatic",
  "Banco FICOHSA",
  "Banco Agromercantil (BAM)",
  "Banco G&T Continental",
]);

interface DashboardViewProps {
  transactions: Transaction[];
  summary: CSVParsingSummary | null;
  bankName: string | null;
  customCategories: CustomCategory[];
  onAddMoreStatements: () => void;
  onResetSession: () => void;
  renderDrawerContent: (
    filter: DrawerFilter | null,
    onClearFilter: () => void
  ) => React.ReactNode;
  isClassifyingWithLLM?: boolean;
}

export function DashboardView({
  transactions,
  summary,
  bankName,
  customCategories,
  onAddMoreStatements,
  onResetSession,
  renderDrawerContent,
  isClassifyingWithLLM = false,
}: DashboardViewProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerFilter, setDrawerFilter] = useState<DrawerFilter | null>(null);
  const STORAGE_KEY_MINIMIZED_PANELS = "expense_tracker_minimized_panels";

  const [minimizedPanels, setMinimizedPanels] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("expense_tracker_minimized_panels");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed;
          }
        }
      } catch (err) {
        console.warn("Error reading minimized panels from localStorage:", err);
      }
    }
    return {};
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY_MINIMIZED_PANELS,
        JSON.stringify(minimizedPanels)
      );
    } catch (err) {
      console.warn("Error saving minimized panels to localStorage:", err);
    }
  }, [minimizedPanels]);

  // Resizable panels dimensions state and persistence
  const containerRef = React.useRef<HTMLElement | null>(null);
  const [dimensions, setDimensions] = useState<PanelDimensions>(() => {
    return loadStoredPanelDimensions();
  });
  const [isResizing, setIsResizing] = useState(false);
  const activeDragRef = React.useRef<{
    panelId: string;
    column: "left" | "right";
    startX: number;
    startY: number;
    startLeftPercent: number;
    startHeight: number;
    containerWidth: number;
  } | null>(null);

  // Drag start handler triggered from panel corner resize indicator
  const handleResizeStart = (
    e: React.MouseEvent | React.TouchEvent,
    panelId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const isLeftColumn =
      panelId === "panel-category-trends" ||
      panelId === "panel-consumption-patterns";

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const containerRect = containerRef.current?.getBoundingClientRect();
    const containerWidth = containerRect ? containerRect.width : window.innerWidth;

    const currentHeight =
      dimensions.heights[panelId] ||
      DEFAULT_PANEL_DIMENSIONS.heights[panelId] ||
      440;

    activeDragRef.current = {
      panelId,
      column: isLeftColumn ? "left" : "right",
      startX: clientX,
      startY: clientY,
      startLeftPercent: dimensions.leftWidthPercent,
      startHeight: currentHeight,
      containerWidth,
    };

    setIsResizing(true);
    document.body.style.cursor = "se-resize";
    document.body.style.userSelect = "none";
  };

  // Window event listeners for high performance, smooth 60fps dragging
  useEffect(() => {
    if (!isResizing) return;

    let rafId: number | null = null;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!activeDragRef.current) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        if (!activeDragRef.current) return;
        const {
          panelId,
          column,
          startX,
          startY,
          startLeftPercent,
          startHeight,
          containerWidth,
        } = activeDragRef.current;

        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        // Vertical height adjustment (min 260px, max 850px)
        const newHeight = Math.max(
          260,
          Math.min(850, Math.round(startHeight + deltaY))
        );

        // Horizontal width adjustment (applicable when container is >= 640px wide)
        let newLeftPercent = startLeftPercent;
        if (containerWidth >= 640) {
          if (column === "left") {
            const percentDelta = (deltaX / containerWidth) * 100;
            newLeftPercent = Math.max(
              25,
              Math.min(75, Math.round(startLeftPercent + percentDelta))
            );
          } else {
            const percentDelta = (deltaX / containerWidth) * 100;
            newLeftPercent = Math.max(
              25,
              Math.min(75, Math.round(startLeftPercent - percentDelta))
            );
          }
        }

        setDimensions((prev) => ({
          leftWidthPercent: newLeftPercent,
          heights: {
            ...prev.heights,
            [panelId]: newHeight,
          },
        }));
      });
    };

    const handlePointerUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      activeDragRef.current = null;
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      // Persist final dimensions to localStorage
      setDimensions((latest) => {
        saveStoredPanelDimensions(latest);
        return latest;
      });
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: true });
    window.addEventListener("touchend", handlePointerUp);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  const handleResetSize = (panelId?: string) => {
    if (panelId) {
      setDimensions((prev) => {
        const next: PanelDimensions = {
          leftWidthPercent: DEFAULT_PANEL_DIMENSIONS.leftWidthPercent,
          heights: {
            ...prev.heights,
            [panelId]: DEFAULT_PANEL_DIMENSIONS.heights[panelId] || 440,
          },
        };
        saveStoredPanelDimensions(next);
        return next;
      });
    } else {
      setDimensions(DEFAULT_PANEL_DIMENSIONS);
      resetStoredPanelDimensions();
    }
  };

  const [activeInfoPanel, setActiveInfoPanel] = useState<string | null>(null);
  const [activeSettingsPanel, setActiveSettingsPanel] = useState<string | null>(null);

  const handleSelectTrendPoint = (point: {
    category: string;
    monthKey: string;
    monthLabel: string;
  }) => {
    setDrawerFilter({
      category: point.category,
      monthKey: point.monthKey,
      displayLabel: `${point.category} · ${point.monthLabel}`,
    });
    setIsDrawerOpen(true);
  };

  const handleSelectTemporalFilter = (temporal: {
    type: "dayOfWeek" | "dayOfMonth";
    value: number;
    label: string;
  }) => {
    if (temporal.type === "dayOfWeek") {
      setDrawerFilter({
        dayOfWeek: temporal.value,
        displayLabel: temporal.label,
      });
    } else {
      setDrawerFilter({
        dayOfMonth: temporal.value,
        displayLabel: temporal.label,
      });
    }
    setIsDrawerOpen(true);
  };

  const handleSelectAgeSegment = (segment: {
    id: TransactionAgeSegmentId;
    label: string;
    monthKey?: string | null;
    monthLabel?: string | null;
  }) => {
    setDrawerFilter({
      segmentId: segment.id,
      monthKey: segment.monthKey,
      displayLabel: segment.monthLabel
        ? `${segment.label} · ${segment.monthLabel}`
        : segment.label,
    });
    setIsDrawerOpen(true);
  };

  const toggleMinimize = (panelId: string) => {
    setMinimizedPanels((prev) => ({
      ...prev,
      [panelId]: !prev[panelId],
    }));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveInfoPanel(null);
        setActiveSettingsPanel(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
              {bankName && VERIFIED_BANKS.has(bankName) && (
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
                      setDrawerFilter({ category: "Pendiente", displayLabel: "Sin clasificar" });
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

          {/* Reset panels dimensions */}
          <button
            type="button"
            id="btn-reset-panel-sizes"
            onClick={() => handleResetSize()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs sm:text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 border border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
            title="Restablecer tamaños originales de los paneles"
          >
            <Icons.Maximize2 className="w-3 h-3" />
            <span className="hidden xl:inline">Restablecer tamaños</span>
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

          {/* Open Sliding Transaction Drawer */}
          <button
            type="button"
            id="btn-toggle-transactions-drawer"
            onClick={() => {
              setDrawerFilter(null);
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

      {/* Main 4-Panel 2x2 Responsive Grid with Fluid Horizontal & Vertical Resizing */}
      <main
        ref={containerRef}
        style={{
          "--left-col-width": `${dimensions.leftWidthPercent}fr`,
          "--right-col-width": `${100 - dimensions.leftWidthPercent}fr`,
        } as React.CSSProperties}
        className="flex-1 p-3.5 sm:p-4 lg:p-5 grid grid-cols-1 lg:grid-cols-[var(--left-col-width)_var(--right-col-width)] gap-3.5 lg:gap-4 items-start"
      >
        {/* Left Column: Panel 1 (Top) & Panel 3 (Bottom) */}
        <div className="flex flex-col gap-3.5 lg:gap-4 min-w-0">
          <DashboardPanelSection
            id="panel-category-trends"
            title="Histórico por categoría"
            height={dimensions.heights["panel-category-trends"] || 440}
            onResizeStart={handleResizeStart}
            onResetSize={handleResetSize}
            isResizing={isResizing}
            isMinimized={!!minimizedPanels["panel-category-trends"]}
            onToggleMinimize={() => toggleMinimize("panel-category-trends")}
            isInfoActive={activeInfoPanel === "panel-category-trends"}
            onToggleInfo={() =>
              setActiveInfoPanel((prev) =>
                prev === "panel-category-trends" ? null : "panel-category-trends"
              )
            }
            tutorialContent={PANEL_TUTORIALS["panel-category-trends"].content}
          >
            <CategoryTrendChart
              transactions={transactions}
              customCategories={customCategories}
              onSelectDataPoint={handleSelectTrendPoint}
            />
          </DashboardPanelSection>

          <DashboardPanelSection
            id="panel-consumption-patterns"
            title="Patrones de consumo"
            height={dimensions.heights["panel-consumption-patterns"] || 440}
            onResizeStart={handleResizeStart}
            onResetSize={handleResetSize}
            isResizing={isResizing}
            isMinimized={!!minimizedPanels["panel-consumption-patterns"]}
            onToggleMinimize={() => toggleMinimize("panel-consumption-patterns")}
            isInfoActive={activeInfoPanel === "panel-consumption-patterns"}
            onToggleInfo={() =>
              setActiveInfoPanel((prev) =>
                prev === "panel-consumption-patterns"
                  ? null
                  : "panel-consumption-patterns"
              )
            }
            tutorialContent={PANEL_TUTORIALS["panel-consumption-patterns"].content}
          >
            <ConsumptionPatternsChart
              transactions={transactions}
              onSelectTemporalFilter={handleSelectTemporalFilter}
            />
          </DashboardPanelSection>
        </div>

        {/* Right Column: Panel 2 (Top) & Panel 4 (Bottom) */}
        <div className="flex flex-col gap-3.5 lg:gap-4 min-w-0">
          <DashboardPanelSection
            id="panel-vendor-concentration"
            title="¿A dónde va mi dinero?"
            height={dimensions.heights["panel-vendor-concentration"] || 440}
            onResizeStart={handleResizeStart}
            onResetSize={handleResetSize}
            isResizing={isResizing}
            isMinimized={!!minimizedPanels["panel-vendor-concentration"]}
            onToggleMinimize={() => toggleMinimize("panel-vendor-concentration")}
            isInfoActive={activeInfoPanel === "panel-vendor-concentration"}
            onToggleInfo={() => {
              setActiveInfoPanel((prev) =>
                prev === "panel-vendor-concentration"
                  ? null
                  : "panel-vendor-concentration"
              );
              setActiveSettingsPanel(null);
            }}
            isSettingsActive={activeSettingsPanel === "panel-vendor-concentration"}
            onToggleSettings={() => {
              setActiveSettingsPanel((prev) =>
                prev === "panel-vendor-concentration"
                  ? null
                  : "panel-vendor-concentration"
              );
              setActiveInfoPanel(null);
            }}
            tutorialContent={PANEL_TUTORIALS["panel-vendor-concentration"].content}
          >
            <VendorConcentrationChart
              transactions={transactions}
              customCategories={customCategories}
              isSettingsOpen={activeSettingsPanel === "panel-vendor-concentration"}
              onToggleSettings={() => {
                setActiveSettingsPanel((prev) =>
                  prev === "panel-vendor-concentration"
                    ? null
                    : "panel-vendor-concentration"
                );
                setActiveInfoPanel(null);
              }}
            />
          </DashboardPanelSection>

          <DashboardPanelSection
            id="panel-transaction-age"
            title="Antigüedad del gasto"
            height={dimensions.heights["panel-transaction-age"] || 440}
            onResizeStart={handleResizeStart}
            onResetSize={handleResetSize}
            isResizing={isResizing}
            isMinimized={!!minimizedPanels["panel-transaction-age"]}
            onToggleMinimize={() => toggleMinimize("panel-transaction-age")}
            isInfoActive={activeInfoPanel === "panel-transaction-age"}
            onToggleInfo={() =>
              setActiveInfoPanel((prev) =>
                prev === "panel-transaction-age" ? null : "panel-transaction-age"
              )
            }
            tutorialContent={PANEL_TUTORIALS["panel-transaction-age"].content}
          >
            <TransactionAgeChart
              transactions={transactions}
              onSelectSegment={handleSelectAgeSegment}
            />
          </DashboardPanelSection>
        </div>
      </main>

      {/* Off-canvas Sliding Transaction Drawer */}
      <SlidingDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setDrawerFilter(null);
        }}
        title="Detalle de movimientos"
        totalCount={totalCount}
        activeFilterLabel={drawerFilter?.displayLabel}
        onClearFilter={() => setDrawerFilter(null)}
      >
        {renderDrawerContent(drawerFilter, () => setDrawerFilter(null))}
      </SlidingDrawer>
    </div>
  );
}

