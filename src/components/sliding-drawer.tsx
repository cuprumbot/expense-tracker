"use client";

import React, { useEffect } from "react";
import { Icons } from "@/components/icons";

interface SlidingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  totalCount?: number;
  activeFilterLabel?: string | null;
  filteredCount?: number;
  onClearFilter?: () => void;
  children: React.ReactNode;
}

export function SlidingDrawer({
  isOpen,
  onClose,
  title = "Transacciones detalladas",
  totalCount,
  activeFilterLabel,
  filteredCount,
  onClearFilter,
  children,
}: SlidingDrawerProps) {
  // Listen for Escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      // Prevent background body scroll when drawer is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  return (
    <div
      className={`fixed inset-0 z-40 transition-visibility duration-300 ${
        isOpen ? "pointer-events-auto visible" : "pointer-events-none invisible"
      }`}
      aria-hidden={!isOpen}
    >
      {/* Semi-transparent Backdrop Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* Sliding Drawer Container */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-5xl bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 shrink-0 gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h2>
            {activeFilterLabel && (
              <div
                id="drawer-active-filter-badge"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-medium bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80 shadow-2xs"
              >
                <span>
                  Filtrado por: <strong>{activeFilterLabel}</strong>
                  {typeof filteredCount === "number" ? ` (${filteredCount} movimientos)` : ""}
                </span>
                {onClearFilter && (
                  <button
                    type="button"
                    id="btn-drawer-clear-filter"
                    onClick={onClearFilter}
                    className="p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400 cursor-pointer"
                    title="Quitar filtro"
                    aria-label="Quitar filtro"
                  >
                    <Icons.X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeFilterLabel && onClearFilter && (
              <button
                type="button"
                id="btn-drawer-show-all-transactions"
                onClick={onClearFilter}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors cursor-pointer"
                title="Quitar filtro y mostrar todas las transacciones"
              >
                <Icons.RotateCcw className="w-3.5 h-3.5" />
                <span>Mostrar todas</span>
              </button>
            )}

            <button
              type="button"
              id="btn-close-sliding-drawer"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
              title="Cerrar panel de transacciones (Esc)"
            >
              <Icons.X className="w-4 h-4" />
              <span>Ocultar transacciones</span>
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {children}
        </div>
      </aside>
    </div>
  );
}
