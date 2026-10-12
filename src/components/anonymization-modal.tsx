"use client";

import React, { useState, useMemo } from "react";
import { Icons } from "@/components/icons";
import {
  anonymizeStatementText,
  REDACTION_PLACEHOLDERS,
} from "@/lib/anonymizer";

interface AnonymizationModalProps {
  isOpen: boolean;
  bankName: string;
  rawText: string;
  onConfirm: (sanitizedText: string) => void;
  onCancel: () => void;
}

export function AnonymizationModal({
  isOpen,
  bankName,
  rawText,
  onConfirm,
  onCancel,
}: AnonymizationModalProps) {
  const [customWords, setCustomWords] = useState<string[]>([]);
  const [newWordInput, setNewWordInput] = useState("");

  // Dynamically compute anonymization with any user-added custom terms
  const anonymizationResult = useMemo(() => {
    return anonymizeStatementText(rawText, customWords);
  }, [rawText, customWords]);

  if (!isOpen) return null;

  const handleAddCustomWord = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newWordInput.trim();
    if (!trimmed || customWords.includes(trimmed)) return;

    setCustomWords((prev) => [...prev, trimmed]);
    setNewWordInput("");
  };

  const handleRemoveCustomWord = (wordToRemove: string) => {
    setCustomWords((prev) => prev.filter((w) => w !== wordToRemove));
  };

  const handleConfirm = () => {
    onConfirm(anonymizationResult.sanitizedText);
  };

  const { sanitizedText, redactionsCount } = anonymizationResult;

  // Split text by recognized placeholders for rich highlighted rendering
  const placeholderRegex = /(\[(?:NOMBRE|DIRECCION|CUENTA|IDENTIFICACION|CONTACTO|DATO)_REDACTADO\])/g;
  const previewParts = sanitizedText.split(placeholderRegex);

  const getPlaceholderStyle = (placeholder: string) => {
    switch (placeholder) {
      case REDACTION_PLACEHOLDERS.name:
        return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800";
      case REDACTION_PLACEHOLDERS.address:
        return "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-800";
      case REDACTION_PLACEHOLDERS.account:
        return "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800";
      case REDACTION_PLACEHOLDERS.id:
        return "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800";
      case REDACTION_PLACEHOLDERS.contact:
        return "bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-200 dark:border-cyan-800";
      case REDACTION_PLACEHOLDERS.custom:
        return "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800";
      default:
        return "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="anonymization-modal-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white border border-zinc-200 shadow-2xl dark:bg-zinc-950 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 p-6 sm:p-7 space-y-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0 mt-0.5">
              <Icons.ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2
                  id="anonymization-modal-title"
                  className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
                >
                  Anonimización y privacidad local
                </h2>
                <span className="text-2xs font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {bankName || "Banco no compatible"}
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Toda la información personal fue anonimizada localmente en tu dispositivo. Revisa el texto protegido y agrega términos adicionales si lo deseas antes de procesar.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            aria-label="Cerrar y cancelar"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>

        {/* Redactions KPI Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/40">
            <span className="text-2xs text-zinc-500 dark:text-zinc-400 block font-medium">
              Nombres
            </span>
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400 font-mono">
              {redactionsCount.name} protegidos
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/40">
            <span className="text-2xs text-zinc-500 dark:text-zinc-400 block font-medium">
              Cuentas y tarjetas
            </span>
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-400 font-mono">
              {redactionsCount.account} protegidas
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/40">
            <span className="text-2xs text-zinc-500 dark:text-zinc-400 block font-medium">
              Direcciones
            </span>
            <span className="text-sm font-semibold text-purple-700 dark:text-purple-400 font-mono">
              {redactionsCount.address} protegidas
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/40">
            <span className="text-2xs text-zinc-500 dark:text-zinc-400 block font-medium">
              Contacto y teléfono
            </span>
            <span className="text-sm font-semibold text-cyan-700 dark:text-cyan-400 font-mono">
              {redactionsCount.contact} protegidos
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/40">
            <span className="text-2xs text-zinc-500 dark:text-zinc-400 block font-medium">
              Identificaciones / NIT
            </span>
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 font-mono">
              {redactionsCount.id} protegidas
            </span>
          </div>

          <div className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/40">
            <span className="text-2xs text-zinc-500 dark:text-zinc-400 block font-medium">
              Total datos protegidos
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
              {redactionsCount.total} elementos
            </span>
          </div>
        </div>

        {/* Manual Additional Redaction Tool */}
        <div className="space-y-2 border border-zinc-200 rounded-lg p-3.5 bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-900/30">
          <label
            htmlFor="custom-redaction-input"
            className="text-xs font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5"
          >
            <Icons.Lock className="w-3.5 h-3.5 text-zinc-500" />
            <span>Redactar palabra o texto adicional manualmente:</span>
          </label>
          <form onSubmit={handleAddCustomWord} className="flex gap-2">
            <input
              id="custom-redaction-input"
              type="text"
              value={newWordInput}
              onChange={(e) => setNewWordInput(e.target.value)}
              placeholder="Ej. Nombre de familiar, concepto sensible..."
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white dark:bg-zinc-900 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
            <button
              type="submit"
              disabled={!newWordInput.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
            >
              Redactar
            </button>
          </form>

          {customWords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {customWords.map((word) => (
                <span
                  key={word}
                  className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                >
                  <span>{word}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomWord(word)}
                    className="hover:text-rose-950 dark:hover:text-rose-100"
                    aria-label={`Eliminar ${word}`}
                  >
                    <Icons.X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Sanitized Text Scrollable Preview */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Vista previa del texto anonimizado:</span>
            <span className="font-mono text-2xs">100% Procesado localmente</span>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Texto anonimizado con datos protegidos"
            className="w-full max-h-64 overflow-y-auto p-3.5 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 font-mono text-2xs leading-relaxed whitespace-pre-wrap select-text focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
          >
            {previewParts.map((part, index) => {
              if (placeholderRegex.test(part)) {
                return (
                  <span
                    key={`${part}-${index}`}
                    className={`inline-block px-1 py-0.2 mx-0.5 rounded border text-2xs font-semibold ${getPlaceholderStyle(
                      part
                    )}`}
                  >
                    {part}
                  </span>
                );
              }
              return <span key={index}>{part}</span>;
            })}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:text-zinc-400 dark:border-zinc-700 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-xs"
          >
            <Icons.Check className="w-3.5 h-3.5" />
            <span>Confirmar y procesar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
