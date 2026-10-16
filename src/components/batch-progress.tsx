"use client";

import React from "react";
import { Icons } from "@/components/icons";
import { BatchItem } from "@/lib/batch-processor";

interface BatchProgressProps {
  items: BatchItem[];
}

export function BatchProgress({ items }: BatchProgressProps) {
  const total = items.length;
  const finished = items.filter(
    (i) => i.status === "completed" || i.status === "error"
  ).length;
  const currentItem = items.find((i) => i.status === "processing");
  const progressPercent = total > 0 ? Math.round((finished / total) * 100) : 0;

  return (
    <section
      role="region"
      aria-label="Progreso de procesamiento de archivos"
      id="batch-progress-section"
      className="border border-zinc-200 rounded-2xl bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-950 shadow-xs space-y-6 animate-in fade-in duration-200"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Procesando lote de estados de cuenta
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {currentItem
              ? `Analizando: ${currentItem.file.name}`
              : `Procesados ${finished} de ${total} archivos`}
          </p>
        </div>

        <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900">
          {finished} / {total} completados
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full bg-zinc-100 rounded-full h-2 dark:bg-zinc-900 overflow-hidden">
          <div
            className="bg-zinc-900 h-2 rounded-full transition-all duration-300 ease-out dark:bg-zinc-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* List of files with their individual status */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-900 border border-zinc-100 dark:border-zinc-900 rounded-xl overflow-hidden">
        {items.map((item, index) => {
          const isCurrent = item.status === "processing";
          const isDone = item.status === "completed";
          const isErr = item.status === "error";

          return (
            <div
              key={item.id || `item-${index}-${item.file.name}`}
              className={`p-3.5 flex items-center justify-between gap-3 text-xs transition-colors ${
                isCurrent
                  ? "bg-zinc-50/80 dark:bg-zinc-900/60"
                  : isErr
                  ? "bg-red-50/40 dark:bg-red-950/20"
                  : "bg-white dark:bg-zinc-950"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0 dark:bg-zinc-900 dark:text-zinc-300">
                  {item.type === "pdf" ? (
                    <Icons.FileText className="w-4 h-4" />
                  ) : (
                    <Icons.FileSpreadsheet className="w-4 h-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate block">
                    {item.file.name}
                  </span>
                  <p
                    className={`text-2xs truncate ${
                      isErr
                        ? "text-red-600 dark:text-red-400 font-medium"
                        : isDone
                        ? "text-emerald-700 dark:text-emerald-400"
                        : isCurrent
                        ? "text-zinc-600 dark:text-zinc-300 font-medium"
                        : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {item.statusMessage || (isCurrent ? `Procesando ${item.file.name}...` : "En espera")}
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {isCurrent && (
                  <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium text-2xs">
                    <Icons.RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span className="hidden sm:inline">Procesando</span>
                  </div>
                )}
                {isDone && (
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-2xs">
                    <Icons.CheckCircle2 className="w-4 h-4" />
                    <span>Completado</span>
                  </div>
                )}
                {isErr && (
                  <div className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium text-2xs">
                    <Icons.AlertCircle className="w-4 h-4" />
                    <span>Error</span>
                  </div>
                )}
                {item.status === "idle" && (
                  <span className="text-2xs text-zinc-400 dark:text-zinc-600">
                    En cola
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
