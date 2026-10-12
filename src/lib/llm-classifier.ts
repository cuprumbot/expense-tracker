import { GoogleGenAI } from "@google/genai";
import { validateSanitizedPayload } from "@/lib/llm-extractor";

export interface UnclassifiedExpenseItem {
  id: string;
  description: string;
  amount: number;
}

export interface ClassifiedExpenseItem {
  id: string;
  category: string;
  isSubscription?: boolean;
}

export interface ClassifyExpensesPayload {
  unclassifiedTransactions: UnclassifiedExpenseItem[];
  availableCategories: string[];
}

export interface ClassifyExpensesResult {
  success: boolean;
  classifications: ClassifiedExpenseItem[];
  error?: string;
}

/**
 * Validates that the classification payload sent to Gemini Pro adheres strictly
 * to the Split-Brain architecture (only descriptions and amounts, zero PII).
 */
export function validateExpenseClassificationPayload(
  payload: ClassifyExpensesPayload
): { isValid: boolean; reason?: string } {
  if (!payload) {
    return { isValid: false, reason: "El cuerpo de la solicitud está vacío." };
  }

  if (
    !Array.isArray(payload.unclassifiedTransactions) ||
    payload.unclassifiedTransactions.length === 0
  ) {
    return {
      isValid: false,
      reason: "No se proporcionaron transacciones pendientes para clasificar.",
    };
  }

  if (
    !Array.isArray(payload.availableCategories) ||
    payload.availableCategories.length === 0
  ) {
    return {
      isValid: false,
      reason: "No se proporcionó la lista de categorías disponibles.",
    };
  }

  for (const item of payload.unclassifiedTransactions) {
    if (!item.id || typeof item.id !== "string") {
      return {
        isValid: false,
        reason: "Cada transacción debe incluir un identificador válido.",
      };
    }
    if (!item.description || typeof item.description !== "string") {
      return {
        isValid: false,
        reason: "Cada transacción debe incluir una descripción de texto.",
      };
    }
    if (typeof item.amount !== "number" || isNaN(item.amount)) {
      return {
        isValid: false,
        reason: "Cada transacción debe incluir un monto numérico válido.",
      };
    }

    // Verify description does not contain unredacted PII (IBAN, DPI, emails)
    const piiCheck = validateSanitizedPayload(item.description);
    if (!piiCheck.isValid) {
      return {
        isValid: false,
        reason: `Dato sensible detectado en descripción: ${piiCheck.reason}`,
      };
    }
  }

  return { isValid: true };
}

/**
 * System instruction provided to Gemini Pro for expense classification.
 */
export const CLASSIFICATION_SYSTEM_INSTRUCTION = `
You are a personal finance assistant specialized in categorizing bank expenses and transactions in Guatemala.
You will receive:
1. A list of available predefined categories in Spanish.
2. A list of unclassified transactions containing only transaction ID, merchant description, and amount in Guatemalan Quetzales (GTQ).
All personal identifying information (PII) has been stripped locally.

Instructions:
1. For each transaction, select the most accurate category from the provided categories list.
2. If none of the predefined categories fit well, you may suggest a concise, intuitive category name in Spanish (e.g. "Educación", "Mascotas", "Tecnología").
3. If an expense is a recurring digital service or streaming platform (e.g., Netflix, Spotify, Disney, Apple, Google, OpenAI, etc.), assign it to "Suscripciones" and set "isSubscription": true.
4. If an expense is ambiguous or cannot be determined with confidence, assign it to "Pendiente".
5. Return ONLY a valid JSON array of objects. Do not include explanatory text or markdown codeblocks outside the JSON array.

Response JSON Schema:
[
  {
    "id": "string (matching the exact transaction ID provided)",
    "category": "string (Category name in Spanish)",
    "isSubscription": false
  }
]
`;

/**
 * Builds user prompt content with structured unclassified items and candidate categories.
 */
export function buildClassificationPrompt(
  transactions: UnclassifiedExpenseItem[],
  categories: string[]
): string {
  const payloadData = {
    categorias_disponibles: categories,
    gastos_pendientes: transactions.map((t) => ({
      id: t.id,
      descripcion: t.description,
      monto_gtq: t.amount,
    })),
  };

  return `Por favor clasifica los siguientes gastos pendientes según las categorías disponibles:\n\n${JSON.stringify(
    payloadData,
    null,
    2
  )}`;
}

/**
 * Parses and validates structured JSON response from Gemini Pro.
 */
export function parseLLMClassificationResponse(
  rawText: string
): ClassifiedExpenseItem[] {
  let cleaned = rawText.trim();

  // Strip markdown fences if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  cleaned = cleaned.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("Error al parsear JSON devuelto por Gemini Pro:", err, cleaned);
    throw new Error(
      "La respuesta de Gemini Pro no contiene un formato JSON válido."
    );
  }

  // Handle case where output is wrapped in an object
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const keys = Object.keys(parsed);
    for (const key of keys) {
      if (Array.isArray((parsed as Record<string, unknown>)[key])) {
        parsed = (parsed as Record<string, unknown>)[key];
        break;
      }
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      "La respuesta del modelo debe ser una lista de clasificaciones."
    );
  }

  const results: ClassifiedExpenseItem[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;

    const id = String(item.id || "").trim();
    const category = String(item.category || item.categoria || "Pendiente").trim();
    const isSubscription = Boolean(
      item.isSubscription ||
        item.esSuscripcion ||
        category.toLowerCase() === "suscripciones"
    );

    if (id) {
      results.push({
        id,
        category: category || "Pendiente",
        isSubscription: isSubscription ? true : undefined,
      });
    }
  }

  return results;
}

/**
 * Server-side helper to classify unclassified expenses using Gemini Pro (@google/genai SDK).
 * Adheres strictly to Split-Brain: sends ONLY descriptions and amounts, no user identity.
 */
export async function classifyExpensesWithGemini(
  transactions: UnclassifiedExpenseItem[],
  categories: string[]
): Promise<ClassifiedExpenseItem[]> {
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
  const prompt = buildClassificationPrompt(transactions, categories);

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
          systemInstruction: CLASSIFICATION_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
        },
      });

      if (response && response.text) {
        rawResponseText = response.text;
        break;
      }
    } catch (err) {
      lastError = err;
      console.warn(`Error al intentar clasificar con modelo ${model}:`, err);
    }
  }

  if (!rawResponseText) {
    const errorMsg =
      lastError instanceof Error
        ? lastError.message
        : "Error desconocido al llamar a Gemini Pro";
    throw new Error(`Error al comunicarse con Gemini Pro: ${errorMsg}`);
  }

  return parseLLMClassificationResponse(rawResponseText);
}
