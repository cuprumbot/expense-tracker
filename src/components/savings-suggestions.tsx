"use client";

import React, { useState } from "react";
import { Icons } from "@/components/icons";
import { formatCurrency } from "@/lib/currency";
import {
  SavingsRecommendationResponse,
  SavingsPayload,
  buildSavingsPayload,
} from "@/lib/savings-advisor";
import { ReportingMetrics } from "@/lib/reporting";
import { SubscriptionSummary } from "@/lib/expense-classifier";
import { CustomCategory } from "@/types/transaction";

interface SavingsSuggestionsProps {
  metrics: ReportingMetrics;
  subscriptionSummary: SubscriptionSummary;
  customCategories?: CustomCategory[];
  initialRecommendations?: SavingsRecommendationResponse | null;
  onRecommendationsChange?: (
    recommendations: SavingsRecommendationResponse | null
  ) => void;
}

export function SavingsSuggestions({
  metrics,
  subscriptionSummary,
  customCategories = [],
  initialRecommendations = null,
  onRecommendationsChange,
}: SavingsSuggestionsProps) {
  const [recommendations, setRecommendations] =
    useState<SavingsRecommendationResponse | null>(initialRecommendations);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Build Split-Brain safe payload: aggregated category spend + recurring services only
      const payload: SavingsPayload = buildSavingsPayload(
        metrics,
        subscriptionSummary,
        customCategories
      );

      // 2. Call Next.js Server Route Handler
      const response = await fetch("/api/suggest-savings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "No se pudieron generar las sugerencias de ahorro en este momento."
        );
      }

      setRecommendations(data.recommendations);
      onRecommendationsChange?.(data.recommendations);
    } catch (err) {
      console.error("Error al obtener sugerencias de ahorro:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Error de conexión al generar sugerencias de ahorro.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Initial State: Show Call-To-Action button when suggestions have not been generated yet
  if (!recommendations && !isLoading && !error) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Icons.Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                Sugerencias de ahorro
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Utiliza Gemini para generar sugerencias de ahorro. Tu información personal (nombre, dirección, banco, etc.) no es enviada al modelo.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchSuggestions}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white shadow-xs hover:shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Icons.Sparkles className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>Obtener sugerencias de ahorro</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Loading State: Skeleton shimmer + informative message
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 shadow-xs space-y-5 animate-pulse">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Icons.RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Analizando oportunidades de ahorro con Gemini Pro...
              </h3>
              <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                Evaluando gastos por categoría y suscripciones activas
              </p>
            </div>
          </div>
          <div className="h-6 w-36 bg-zinc-100 dark:bg-zinc-800 rounded-md" />
        </div>

        <div className="h-16 w-full bg-zinc-50 dark:bg-zinc-900/50 rounded-xl" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
          <div className="h-28 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl" />
          <div className="h-28 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl" />
        </div>
      </div>
    );
  }

  // 3. Error State: Alert with Retry CTA
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/70 p-5 dark:border-red-900/50 dark:bg-red-950/30 space-y-3">
        <div className="flex items-start gap-3">
          <Icons.AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <h4 className="text-xs font-semibold text-red-900 dark:text-red-200">
              No se pudieron obtener sugerencias de ahorro
            </h4>
            <p className="text-2xs text-red-700 dark:text-red-300 leading-relaxed">
              {error}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-red-200/60 dark:border-red-900/40">
          <button
            type="button"
            onClick={fetchSuggestions}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 transition-colors cursor-pointer shadow-2xs"
          >
            <Icons.RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar análisis</span>
          </button>
        </div>
      </div>
    );
  }

  if (!recommendations) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950 shadow-xs space-y-6">
      {/* Header bar with potential savings KPI and Refresh button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <Icons.Sparkles className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Sugerencias de ahorro
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {recommendations.potencialAhorroMensualTotalGTQ > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-200">
              <Icons.PiggyBank className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-right">
                <span className="text-3xs block uppercase tracking-wider font-semibold opacity-75">
                  Ahorro potencial estimado
                </span>
                <span className="text-xs sm:text-sm font-bold font-mono whitespace-nowrap">
                  {formatCurrency(
                    recommendations.potencialAhorroMensualTotalGTQ
                  ).replace(" ", "\u00A0")}{" "}
                  <span className="text-2xs font-normal opacity-80">/ mes</span>
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={fetchSuggestions}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer shrink-0"
            title="Volver a generar sugerencias con Gemini Pro"
          >
            <Icons.RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Actualizar sugerencias</span>
          </button>
        </div>
      </div>

      {/* General Summary Callout */}
      {recommendations.resumenGeneral && (
        <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/60 dark:border-zinc-800/80 dark:bg-zinc-900/40 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
            <Icons.Lightbulb className="w-4 h-4" />
          </div>
          <div className="space-y-0.5 flex-1">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Diagnóstico general
            </span>
            <p className="text-sm sm:text-base text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
              {recommendations.resumenGeneral}
            </p>
          </div>
        </div>
      )}

      {/* Block 1: Oportunidades Inmediatas */}
      {recommendations.oportunidadesInmediatas?.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Icons.TrendingDown className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Acciones inmediatas de ahorro
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Ajustes directos con impacto rápido en tu presupuesto mensual
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {recommendations.oportunidadesInmediatas.map((action, idx) => (
              <div
                key={action.id || `action-${idx}`}
                className="p-4.5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800/90 dark:bg-zinc-900/60 shadow-2xs space-y-2 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                    {action.title}
                  </span>

                  {action.estimatedMonthlySavingsGTQ &&
                    action.estimatedMonthlySavingsGTQ > 0 && (
                      <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 shrink-0 whitespace-nowrap">
                        Ahorro de {formatCurrency(action.estimatedMonthlySavingsGTQ).replace(" ", "\u00A0")} al mes
                      </span>
                    )}
                </div>

                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {action.description}
                </p>

                {action.category && (
                  <div className="pt-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    <Icons.Tag className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Rubro: {action.category}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Block 2: Estrategias a Mediano y Largo Plazo */}
      {recommendations.estrategiasLargoPlazo?.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
              <Icons.Target className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Estrategias de presupuesto a largo plazo
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Hábitos y estructura para mantener finanzas saludables
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {recommendations.estrategiasLargoPlazo.map((strat, idx) => (
              <div
                key={strat.id || `strat-${idx}`}
                className="p-4.5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800/90 dark:bg-zinc-900/60 shadow-2xs space-y-2 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    0{idx + 1}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {strat.title}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {strat.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
