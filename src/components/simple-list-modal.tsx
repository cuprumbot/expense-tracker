"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Icons } from "@/components/icons";
import { formatCurrency } from "@/lib/currency";
import {
  parseSimpleExpenseList,
  SimpleListParsingResult,
} from "@/lib/text-list-parser";

interface SimpleListModalProps {
  isOpen: boolean;
  exchangeRate?: number;
  onClose: () => void;
  onConfirm: (result: SimpleListParsingResult) => void;
}

export function SimpleListModal({
  isOpen,
  exchangeRate = 7.85,
  onClose,
  onConfirm,
}: SimpleListModalProps) {
  const [rawText, setRawText] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset error when text changes
  useEffect(() => {
    if (submitError) {
      setSubmitError(null);
    }
  }, [rawText, submitError]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const livePreview = useMemo(() => {
    if (!rawText.trim()) {
      return {
        validCount: 0,
        skippedCount: 0,
        skippedLines: [] as string[],
        totalAmount: 0,
        transactions: [],
      };
    }
    const parsed = parseSimpleExpenseList(rawText, undefined, exchangeRate);
    return {
      validCount: parsed.summary.validTransactionsCount,
      skippedCount: parsed.summary.skippedLinesCount,
      skippedLines: parsed.summary.skippedLines,
      totalAmount: parsed.summary.totalAmount,
      transactions: parsed.transactions,
    };
  }, [rawText, exchangeRate]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = parseSimpleExpenseList(rawText, undefined, exchangeRate);
    if (!result.success || result.transactions.length === 0) {
      setSubmitError(
        result.error ||
          "No se detectaron gastos válidos. Ingresa al menos una línea con comercio y monto."
      );
      return;
    }

    onConfirm(result);
    setRawText("");
    setSubmitError(null);
  };

  const handleCancel = () => {
    setSubmitError(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      id="modal-simple-expense-list"
      aria-modal="true"
      aria-labelledby="simple-list-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center shrink-0 mt-0.5">
              <Icons.List className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3
                id="simple-list-modal-title"
                className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
              >
                Ingresar lista rápida de gastos
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Escribe o pega tus gastos (uno por línea). Se asignará la fecha de hoy automáticamente y los montos sin símbolo se tomarán en Quetzales (Q).
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-simple-list-modal"
            onClick={handleCancel}
            aria-label="Cerrar ventana"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer shrink-0"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="simple-list-textarea"
                className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Listado de gastos (Comercio y monto en cualquier orden)
              </label>
              <span className="text-2xs text-zinc-500 dark:text-zinc-400">
                Moneda predeterminada: Q (GTQ)
              </span>
            </div>

            <textarea
              id="simple-list-textarea"
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={"Ejemplo:\nWalmart 150\n150 Burger King\n40 super 24\ngasolina 90"}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 px-3.5 py-3 text-xs sm:text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-200 focus:bg-white dark:focus:bg-zinc-950 transition-all resize-y"
            />
          </div>

          {/* Live Validation Counter & Preview */}
          <div
            id="simple-list-live-preview"
            className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50 p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                {livePreview.validCount > 0 ? (
                  <Icons.CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Icons.Info className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                )}
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {livePreview.validCount === 1
                    ? "1 movimiento válido detectado"
                    : `${livePreview.validCount} movimientos válidos detectados`}
                </span>
              </div>

              {livePreview.validCount > 0 && (
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                  Total: {formatCurrency(livePreview.totalAmount)}
                </span>
              )}
            </div>

            {livePreview.transactions.length > 0 && (
              <div className="max-h-28 overflow-y-auto divide-y divide-zinc-200/60 dark:divide-zinc-800/60 border-t border-zinc-200/60 dark:border-zinc-800/60 pt-2 space-y-1">
                {livePreview.transactions.slice(0, 8).map((tx, idx) => (
                  <div
                    key={`preview-${idx}`}
                    className="pt-1 first:pt-0 flex items-center justify-between text-2xs text-zinc-600 dark:text-zinc-300"
                  >
                    <span className="truncate font-medium pr-2">{tx.description}</span>
                    <span className="font-mono shrink-0">{formatCurrency(tx.amount)}</span>
                  </div>
                ))}
                {livePreview.transactions.length > 8 && (
                  <p className="pt-1 text-2xs text-zinc-400 dark:text-zinc-500">
                    Y {livePreview.transactions.length - 8} movimientos adicionales...
                  </p>
                )}
              </div>
            )}

            {livePreview.skippedCount > 0 && (
              <div className="flex items-start gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-900/40 text-2xs text-amber-700 dark:text-amber-300">
                <Icons.AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {livePreview.skippedCount === 1
                    ? `1 línea no contiene un formato válido y será omitida ("${livePreview.skippedLines[0]}").`
                    : `${livePreview.skippedCount} líneas no contienen un formato válido y serán omitidas.`}
                </span>
              </div>
            )}
          </div>

          {/* Submit Error */}
          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-lg border border-red-200 bg-red-50 text-red-900 text-xs dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              <Icons.AlertCircle className="w-4 h-4 mt-0.5 text-red-600 dark:text-red-400 shrink-0" />
              <p className="leading-relaxed">{submitError}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              id="btn-cancel-simple-list"
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <Icons.X className="w-3.5 h-3.5" />
              <span>Cancelar</span>
            </button>

            <button
              type="submit"
              id="btn-submit-simple-list"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Icons.Plus className="w-3.5 h-3.5" />
              <span>Agregar gastos</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

