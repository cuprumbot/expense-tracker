"use client";

import React, { useState } from "react";
import { Icons } from "@/components/icons";
import { CSVColumnMapping } from "@/types/transaction";

interface ColumnMappingModalProps {
  isOpen: boolean;
  headers: string[];
  rawPreviewRows: Record<string, string>[];
  initialMapping?: Partial<CSVColumnMapping>;
  ambiguityReason?: string;
  onConfirm: (mapping: CSVColumnMapping) => void;
  onCancel: () => void;
}

export function ColumnMappingModal({
  isOpen,
  headers,
  rawPreviewRows,
  initialMapping,
  ambiguityReason,
  onConfirm,
  onCancel,
}: ColumnMappingModalProps) {
  const [dateCol, setDateCol] = useState<string>(initialMapping?.dateColumn || "");
  const [descCol, setDescCol] = useState<string>(
    initialMapping?.descriptionColumn || ""
  );
  const [amountCol, setAmountCol] = useState<string>(
    initialMapping?.amountColumn || ""
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!dateCol || !descCol || !amountCol) {
      setValidationError("Debes asignar las tres columnas (Fecha, Descripción y Monto).");
      return;
    }

    if (dateCol === descCol || dateCol === amountCol || descCol === amountCol) {
      setValidationError("Cada campo debe estar asignado a una columna diferente.");
      return;
    }

    onConfirm({
      dateColumn: dateCol,
      descriptionColumn: descCol,
      amountColumn: amountCol,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white border border-zinc-200 shadow-xl dark:bg-zinc-950 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 p-6 space-y-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div className="space-y-1">
            <h2 id="modal-title" className="text-base font-semibold tracking-tight">
              Asignación manual de columnas
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {ambiguityReason ||
                "Se detectaron encabezados ambiguos en tu archivo CSV. Selecciona las columnas correspondientes."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            aria-label="Cerrar modal"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>

        {validationError && (
          <div
            role="alert"
            className="p-3 text-xs rounded-lg border border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 flex items-start gap-2"
          >
            <Icons.AlertCircle className="w-4 h-4 mt-0.5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Selection Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            {/* Date Select */}
            <div className="space-y-1.5">
              <label
                htmlFor="select-date-col"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Columna de Fecha <span className="text-red-500">*</span>
              </label>
              <select
                id="select-date-col"
                value={dateCol}
                onChange={(e) => setDateCol(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                <option value="">-- Selecciona columna para Fecha --</option>
                {headers.map((h) => (
                  <option key={`date-${h}`} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Description Select */}
            <div className="space-y-1.5">
              <label
                htmlFor="select-desc-col"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Columna de Descripción / Comercio <span className="text-red-500">*</span>
              </label>
              <select
                id="select-desc-col"
                value={descCol}
                onChange={(e) => setDescCol(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                <option value="">-- Selecciona columna para Descripción --</option>
                {headers.map((h) => (
                  <option key={`desc-${h}`} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Select */}
            <div className="space-y-1.5">
              <label
                htmlFor="select-amount-col"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Columna de Monto / Gasto (GTQ) <span className="text-red-500">*</span>
              </label>
              <select
                id="select-amount-col"
                value={amountCol}
                onChange={(e) => setAmountCol(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                <option value="">-- Selecciona columna para Monto --</option>
                {headers.map((h) => (
                  <option key={`amount-${h}`} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* CSV Sample Preview */}
          {rawPreviewRows.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-2xs uppercase tracking-wider font-semibold text-zinc-400 dark:text-zinc-500">
                Vista previa de datos del archivo (primeras filas)
              </p>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="min-w-full text-2xs text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                    <tr>
                      {headers.map((h) => (
                        <th key={`th-${h}`} className="px-3 py-1.5 font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono">
                    {rawPreviewRows.slice(0, 3).map((row, idx) => (
                      <tr key={`row-${idx}`} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                        {headers.map((h) => (
                          <td key={`cell-${idx}-${h}`} className="px-3 py-1.5 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                            {row[h] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:text-zinc-400 dark:border-zinc-700 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
            >
              Aplicar y procesar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
