import { GoogleGenAI } from "@google/genai";
import { ReportingMetrics } from "@/lib/reporting";
import { SubscriptionSummary } from "@/lib/expense-classifier";
import { CustomCategory } from "@/types/transaction";
import { validateSanitizedPayload } from "@/lib/llm-extractor";

export interface AggregatedCategorySpending {
  category: string;
  categorySpanish: string;
  totalGTQ: number;
  percentage: number;
  transactionCount: number;
}

export interface RecurringExpenseItem {
  serviceName: string;
  monthlyAmountGTQ: number;
  chargeDate: string;
}

export interface SavingsPayload {
  totalSpendGTQ: number;
  currency: "GTQ";
  categoryBreakdown: AggregatedCategorySpending[];
  recurringExpenses: {
    totalMonthlyCommitmentGTQ: number;
    count: number;
    services: RecurringExpenseItem[];
  };
}

export interface ImmediateActionItem {
  id: string;
  title: string;
  description: string;
  category?: string;
  estimatedMonthlySavingsGTQ?: number;
}

export interface LongTermStrategyItem {
  id: string;
  title: string;
  description: string;
}

export interface CategoryBenchmarkItem {
  category: string;
  status: "optimo" | "moderado" | "elevado";
  observation: string;
  recommendation: string;
}

export interface SavingsRecommendationResponse {
  resumenGeneral: string;
  potencialAhorroMensualTotalGTQ: number;
  oportunidadesInmediatas: ImmediateActionItem[];
  estrategiasLargoPlazo: LongTermStrategyItem[];
  analisisPorCategoria?: CategoryBenchmarkItem[];
}

/**
 * Maps standard Spanish category names to English for optimal LLM reasoning.
 */
export const CATEGORY_NAME_EN_MAP: Record<string, string> = {
  Supermercado: "Groceries & Supermarkets",
  "Restaurantes y Cafés": "Restaurants, Cafés & Food Delivery",
  "Servicios Básicos": "Utilities & Basic Public Services",
  "Transporte y Combustible": "Transportation & Fuel",
  "Salud y Farmacia": "Healthcare, Medicines & Pharmacy",
  "Entretenimiento y Compras": "Shopping, Recreation & Entertainment",
  Suscripciones: "Digital Subscriptions & Recurring Memberships",
  "Tecnología y Computación": "Technology, Hardware & Cloud Services",
  "Hogar y Mascotas": "Home Improvement, Pets & Hardware",
  "Educación y Librerías": "Education, Books & Learning",
  "Cuidado Personal y Belleza": "Personal Care, Grooming & Beauty",
  Pendiente: "Unclassified",
};

/**
 * Builds the strictly anonymized and aggregated payload for Gemini Pro.
 * Split-Brain guarantee:
 * - Aggregated totals only for categories (NO raw non-recurring transactions).
 * - Detailed list ONLY for recurring services (serviceName, monthlyAmountGTQ, chargeDate).
 * - Zero personal identifying information.
 */
export function buildSavingsPayload(
  metrics: ReportingMetrics,
  subscriptionSummary: SubscriptionSummary,
  _customCategories: CustomCategory[] = []
): SavingsPayload {
  const categoryBreakdown: AggregatedCategorySpending[] = metrics.categories
    .filter((c) => c.category !== "Pendiente" && c.total > 0)
    .map((c) => ({
      category: CATEGORY_NAME_EN_MAP[c.category] || c.category,
      categorySpanish: c.category,
      totalGTQ: Number(c.total.toFixed(2)),
      percentage: Number(c.percentage.toFixed(1)),
      transactionCount: c.count,
    }));

  const recurringServices: RecurringExpenseItem[] = (
    subscriptionSummary.services || []
  ).map((sub) => ({
    serviceName: sub.name.trim(),
    monthlyAmountGTQ: Number(sub.amount.toFixed(2)),
    chargeDate: sub.date,
  }));

  return {
    totalSpendGTQ: Number(metrics.totalSpend.toFixed(2)),
    currency: "GTQ",
    categoryBreakdown,
    recurringExpenses: {
      totalMonthlyCommitmentGTQ: Number(
        subscriptionSummary.totalMonthlyCommitment.toFixed(2)
      ),
      count: subscriptionSummary.count,
      services: recurringServices,
    },
  };
}

/**
 * Validates that the payload sent to Gemini Pro strictly conforms
 * to the Split-Brain privacy boundary (no PII, no unapproved raw transaction items).
 */
export function validateSavingsPayload(payload: SavingsPayload): {
  isValid: boolean;
  reason?: string;
} {
  if (!payload || typeof payload !== "object") {
    return { isValid: false, reason: "El cuerpo de la solicitud está vacío." };
  }

  if (typeof payload.totalSpendGTQ !== "number" || isNaN(payload.totalSpendGTQ) || payload.totalSpendGTQ <= 0) {
    return {
      isValid: false,
      reason: "El monto total de gastos debe ser un número positivo.",
    };
  }

  if (!Array.isArray(payload.categoryBreakdown) || payload.categoryBreakdown.length === 0) {
    return {
      isValid: false,
      reason: "Se debe proporcionar el desglose de categorías de gasto.",
    };
  }

  for (const cat of payload.categoryBreakdown) {
    if (!cat.category || typeof cat.category !== "string") {
      return { isValid: false, reason: "Cada categoría debe tener un nombre válido." };
    }
    if (typeof cat.totalGTQ !== "number" || isNaN(cat.totalGTQ)) {
      return { isValid: false, reason: "Cada categoría debe tener un total numérico." };
    }
  }

  if (!payload.recurringExpenses || !Array.isArray(payload.recurringExpenses.services)) {
    return {
      isValid: false,
      reason: "La sección de gastos recurrentes no tiene el formato esperado.",
    };
  }

  // Check recurring services for any unredacted PII (IBAN, DPI, account numbers, email)
  for (const s of payload.recurringExpenses.services) {
    if (!s.serviceName || typeof s.serviceName !== "string") {
      return {
        isValid: false,
        reason: "Cada servicio recurrente debe tener un nombre descriptivo.",
      };
    }
    const piiCheck = validateSanitizedPayload(s.serviceName);
    if (!piiCheck.isValid) {
      return {
        isValid: false,
        reason: `Dato sensible detectado en el nombre de servicio recurrente: ${piiCheck.reason}`,
      };
    }
  }

  return { isValid: true };
}

/*
// Previous prompt including "analisisPorCategoria" (Evaluación por categoría):
export const SAVINGS_SYSTEM_INSTRUCTION_V1 = `
You are an expert personal finance advisor specializing in household budgeting, expense optimization, and consumer savings in Guatemala.
All financial amounts are denominated in Guatemalan Quetzales (GTQ / Q).
All personal identifying information (PII) has been stripped locally.

You will receive:
1. "categoryBreakdown": Aggregated monthly spend for each category (category name in English and Spanish, total in GTQ, percentage of budget, and transaction count). No individual everyday transaction lines are provided.
2. "recurringExpenses": Detailed recurring charges and subscriptions (service name, monthly charge in GTQ, and date).
3. "totalSpendGTQ": Total monthly spending in Quetzales.

Instructions & Financial Guidance:
1. Contextualize all advice to living in Guatemala (e.g., local markets vs major supermarkets, fuel prices, prepaid vs postpaid utility/cellular plans, streaming subscription sharing or consolidation).
2. Deliver actionable, realistic recommendations divided into three areas:
   - "oportunidadesInmediatas": 2 to 4 concrete, immediate action items with quick financial impact (e.g., cancel duplicate or rarely used streaming services, adjust dining out frequency, review utility usage). Each item must include an estimated monthly savings in Quetzales ("estimatedMonthlySavingsGTQ", number) and target category.
   - "estrategiasLargoPlazo": 2 to 3 sustainable budgeting habits (e.g., 50/30/20 budget framework adapted to Guatemala, establishing an emergency fund, weekly meal planning).
   - "analisisPorCategoria": An evaluation for top spend categories assessing whether the allocation is "optimo", "moderado", or "elevado" based on typical Guatemalan middle-class household benchmarks, with a practical recommendation.
3. LANGUAGE REQUIREMENT: All user-facing text, titles, descriptions, recommendations, and observations MUST be in professional, clear, and encouraging SPANISH. Do NOT return English in user-facing text.
4. Return ONLY a valid JSON object matching the JSON schema below. Do not wrap with conversational text outside the JSON.

Expected JSON Schema:
{
  "resumenGeneral": "string (1-2 sentences summarizing the user's spending profile and primary savings potential in Spanish)",
  "potencialAhorroMensualTotalGTQ": 0 (total estimated monthly savings in GTQ from immediate opportunities, number),
  "oportunidadesInmediatas": [
    {
      "id": "accion-1",
      "title": "string (concise Spanish title)",
      "description": "string (clear, actionable explanation in Spanish)",
      "category": "string (Spanish category name, e.g. Suscripciones)",
      "estimatedMonthlySavingsGTQ": 100
    }
  ],
  "estrategiasLargoPlazo": [
    {
      "id": "estrategia-1",
      "title": "string (Spanish strategy title)",
      "description": "string (Spanish explanation of habit or framework)"
    }
  ],
  "analisisPorCategoria": [
    {
      "category": "string (Spanish category name)",
      "status": "optimo | moderado | elevado",
      "observation": "string (observation regarding percentage and spending volume in Spanish)",
      "recommendation": "string (practical optimization advice in Spanish)"
    }
  ]
}
`;
*/

/**
 * System instruction provided to Gemini Pro for money-saving recommendations.
 * Focused on immediate action items and sustainable long-term strategies.
 * "analisisPorCategoria" is removed to prevent overwhelming the user.
 */
export const SAVINGS_SYSTEM_INSTRUCTION = `
You are an expert personal finance advisor specializing in household budgeting, expense optimization, and consumer savings in Guatemala.
All financial amounts are denominated in Guatemalan Quetzales (GTQ / Q).
All personal identifying information (PII) has been stripped locally.

You will receive:
1. "categoryBreakdown": Aggregated monthly spend for each category (category name in English and Spanish, total in GTQ, percentage of budget, and transaction count). No individual everyday transaction lines are provided.
2. "recurringExpenses": Detailed recurring charges and subscriptions (service name, monthly charge in GTQ, and date).
3. "totalSpendGTQ": Total monthly spending in Quetzales.

Instructions & Financial Guidance:
1. Contextualize all advice to living in Guatemala (e.g., local markets vs major supermarkets, fuel prices, prepaid vs postpaid utility/cellular plans, streaming subscription sharing or consolidation).
2. Deliver actionable, realistic recommendations divided into two focused areas:
   - "oportunidadesInmediatas": 2 to 4 concrete, immediate action items with quick financial impact (e.g., cancel duplicate or rarely used streaming services, adjust dining out frequency, review utility usage). Each item must include an estimated monthly savings in Quetzales ("estimatedMonthlySavingsGTQ", number) and target category.
   - "estrategiasLargoPlazo": 2 to 3 sustainable budgeting habits (e.g., 50/30/20 budget framework adapted to Guatemala, establishing an emergency fund, weekly meal planning).
3. LANGUAGE REQUIREMENT: All user-facing text, titles, descriptions, recommendations, and observations MUST be in professional, clear, and encouraging SPANISH. Do NOT return English in user-facing text.
4. Return ONLY a valid JSON object matching the JSON schema below. Do not wrap with conversational text outside the JSON.

Expected JSON Schema:
{
  "resumenGeneral": "string (1-2 sentences summarizing the user's spending profile and primary savings potential in Spanish)",
  "potencialAhorroMensualTotalGTQ": 0 (total estimated monthly savings in GTQ from immediate opportunities, number),
  "oportunidadesInmediatas": [
    {
      "id": "accion-1",
      "title": "string (concise Spanish title)",
      "description": "string (clear, actionable explanation in Spanish)",
      "category": "string (Spanish category name, e.g. Suscripciones)",
      "estimatedMonthlySavingsGTQ": 100
    }
  ],
  "estrategiasLargoPlazo": [
    {
      "id": "estrategia-1",
      "title": "string (Spanish strategy title)",
      "description": "string (Spanish explanation of habit or framework)"
    }
  ]
}
`;

/**
 * Builds the user prompt sent to Gemini Pro with aggregated data and recurring details.
 */
export function buildSavingsPrompt(payload: SavingsPayload): string {
  const data = {
    monthly_budget_summary: {
      total_monthly_spend_gtq: payload.totalSpendGTQ,
      currency: "GTQ (Guatemalan Quetzales)",
    },
    aggregated_category_breakdown: payload.categoryBreakdown.map((cat) => ({
      category_en: cat.category,
      category_es: cat.categorySpanish,
      amount_gtq: cat.totalGTQ,
      percentage_of_total: `${cat.percentage}%`,
      transactions_count: cat.transactionCount,
    })),
    recurring_expenses_details: {
      total_monthly_commitment_gtq:
        payload.recurringExpenses.totalMonthlyCommitmentGTQ,
      active_subscriptions_count: payload.recurringExpenses.count,
      services_list: payload.recurringExpenses.services.map((s) => ({
        service_name: s.serviceName,
        charge_amount_gtq: s.monthlyAmountGTQ,
        charge_date: s.chargeDate,
      })),
    },
  };

  return `Por favor analiza la siguiente estructura de gastos agregados y suscripciones para generar sugerencias concretas de ahorro en Quetzales guatemaltecos:\n\n${JSON.stringify(
    data,
    null,
    2
  )}`;
}

/**
 * Normalizes and validates the JSON response returned by Gemini Pro.
 */
export function parseSavingsResponse(
  rawText: string
): SavingsRecommendationResponse {
  let cleaned = rawText.trim();

  // Strip markdown fences
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  cleaned = cleaned.trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("Error al parsear JSON de sugerencias devuelto por Gemini:", err, cleaned);
    throw new Error(
      "La respuesta de Gemini Pro no contiene un formato JSON válido para las sugerencias de ahorro."
    );
  }

  // Handle case where object is wrapped in a root key
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    if (parsed.recommendations && typeof parsed.recommendations === "object") {
      parsed = parsed.recommendations as Record<string, unknown>;
    } else if (parsed.sugerencias && typeof parsed.sugerencias === "object") {
      parsed = parsed.sugerencias as Record<string, unknown>;
    }
  }

  const resumenGeneral =
    String(
      parsed.resumenGeneral ||
        parsed.resumen_general ||
        parsed.summary ||
        "Se analizaron tus gastos para identificar oportunidades de ahorro y optimización."
    ).trim();

  // Parse immediate actions
  const rawActions = Array.isArray(parsed.oportunidadesInmediatas)
    ? parsed.oportunidadesInmediatas
    : Array.isArray(parsed.oportunidades_inmediatas)
    ? parsed.oportunidades_inmediatas
    : Array.isArray(parsed.immediateActions)
    ? parsed.immediateActions
    : [];

  const oportunidadesInmediatas: ImmediateActionItem[] = rawActions.map(
    (item: Record<string, unknown>, idx: number) => {
      const savings =
        Number(
          item.estimatedMonthlySavingsGTQ ??
            item.ahorroEstimadoMensualGTQ ??
            item.ahorro_estimado_gtq ??
            item.savings
        ) || 0;

      return {
        id: String(item.id || `accion-${idx + 1}`),
        title: String(item.title || item.titulo || `Oportunidad ${idx + 1}`).trim(),
        description: String(
          item.description || item.descripcion || ""
        ).trim(),
        category: item.category || item.categoria ? String(item.category || item.categoria).trim() : undefined,
        estimatedMonthlySavingsGTQ: savings > 0 ? Math.round(savings * 100) / 100 : undefined,
      };
    }
  );

  // Parse long term strategies
  const rawStrategies = Array.isArray(parsed.estrategiasLargoPlazo)
    ? parsed.estrategiasLargoPlazo
    : Array.isArray(parsed.estrategias_largo_plazo)
    ? parsed.estrategias_largo_plazo
    : Array.isArray(parsed.longTermStrategies)
    ? parsed.longTermStrategies
    : [];

  const estrategiasLargoPlazo: LongTermStrategyItem[] = rawStrategies.map(
    (item: Record<string, unknown>, idx: number) => ({
      id: String(item.id || `estrategia-${idx + 1}`),
      title: String(item.title || item.titulo || `Estrategia ${idx + 1}`).trim(),
      description: String(item.description || item.descripcion || "").trim(),
    })
  );

  // Parse category benchmarks
  const rawBenchmarks = Array.isArray(parsed.analisisPorCategoria)
    ? parsed.analisisPorCategoria
    : Array.isArray(parsed.analisis_por_categoria)
    ? parsed.analisis_por_categoria
    : Array.isArray(parsed.categoryBenchmarks)
    ? parsed.categoryBenchmarks
    : [];

  const analisisPorCategoria: CategoryBenchmarkItem[] = rawBenchmarks.map(
    (item: Record<string, unknown>, idx: number) => {
      let status: "optimo" | "moderado" | "elevado" = "moderado";
      const rawStatus = String(item.status || item.estado || "").toLowerCase();
      if (rawStatus.includes("optim") || rawStatus === "low" || rawStatus === "bueno") {
        status = "optimo";
      } else if (rawStatus.includes("elev") || rawStatus === "high" || rawStatus.includes("alt")) {
        status = "elevado";
      }

      return {
        category: String(item.category || item.categoria || `Rubro ${idx + 1}`).trim(),
        status,
        observation: String(item.observation || item.observacion || "").trim(),
        recommendation: String(
          item.recommendation || item.recomendacion || item.tip || ""
        ).trim(),
      };
    }
  );

  // Calculate or retrieve total potential savings
  let totalSavings = Number(
    parsed.potencialAhorroMensualTotalGTQ ??
      parsed.potencial_ahorro_total_gtq ??
      parsed.totalEstimatedSavingsGTQ
  );

  if (isNaN(totalSavings) || totalSavings <= 0) {
    totalSavings = oportunidadesInmediatas.reduce(
      (acc, act) => acc + (act.estimatedMonthlySavingsGTQ || 0),
      0
    );
  }

  return {
    resumenGeneral,
    potencialAhorroMensualTotalGTQ: Math.round(totalSavings * 100) / 100,
    oportunidadesInmediatas,
    estrategiasLargoPlazo,
    analisisPorCategoria,
  };
}

/**
 * Server-side helper to request spending reduction advice from Gemini Pro.
 */
export async function generateSavingsSuggestionsWithGemini(
  payload: SavingsPayload
): Promise<SavingsRecommendationResponse> {
  const activeKey =
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    "";

  if (!activeKey || !activeKey.trim()) {
    throw new Error(
      "No se ha configurado la clave GEMINI_API_KEY en las variables de entorno del servidor. Configure su clave en .env.local para continuar."
    );
  }

  const ai = new GoogleGenAI({ apiKey: activeKey.trim() });
  const prompt = buildSavingsPrompt(payload);

  const candidateModels = [
    process.env.GEMINI_MODEL || "gemini-3.8-flash",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
  ];

  let rawResponseText = "";
  let lastError: unknown = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: SAVINGS_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
        },
      });

      if (response && response.text) {
        rawResponseText = response.text;
        break;
      }
    } catch (err) {
      lastError = err;
      console.warn(`Error al intentar generar sugerencias con modelo ${model}:`, err);
    }
  }

  if (!rawResponseText) {
    const errorMsg =
      lastError instanceof Error
        ? lastError.message
        : "Error desconocido al comunicarse con Gemini Pro";
    throw new Error(`Error al comunicarse con Gemini Pro: ${errorMsg}`);
  }

  return parseSavingsResponse(rawResponseText);
}
