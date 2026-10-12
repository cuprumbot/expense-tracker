import { GoogleGenAI } from "@google/genai";
import { Transaction, CSVParsingSummary } from "@/types/transaction";

/**
 * Validates that a sanitized payload does not leak raw, unredacted PII
 * before sending to an external LLM (Split-Brain boundary check).
 */
export function validateSanitizedPayload(text: string): {
  isValid: boolean;
  reason?: string;
} {
  if (!text || !text.trim()) {
    return {
      isValid: false,
      reason: "El texto proporcionado está vacío.",
    };
  }

  // Check for unredacted Guatemalan IBAN (e.g., GT75 INDL 0101 0000 0006 9579 8863)
  if (/\bGT\d{2}\s*[A-Z]{4}(?:\s*[0-9]{4}){4,6}\b/i.test(text)) {
    return {
      isValid: false,
      reason: "Se detectó un número de cuenta estandarizada (IBAN) sin anonimizar.",
    };
  }

  // Check for unredacted standard bank account format (e.g., 069-579886-3)
  if (/\b\d{3}[-.\s]\d{6,8}[-.\s]\d\b/.test(text)) {
    return {
      isValid: false,
      reason: "Se detectó un número de cuenta bancaria sin anonimizar.",
    };
  }

  // Check for unredacted 13-digit DPI (CUI)
  if (/\b\d{4}\s\d{5}\s\d{4}\b/.test(text)) {
    return {
      isValid: false,
      reason: "Se detectó un número de identificación personal (DPI/CUI) sin anonimizar.",
    };
  }

  // Check for unredacted email addresses
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
    return {
      isValid: false,
      reason: "Se detectó una dirección de correo electrónico sin anonimizar.",
    };
  }

  return { isValid: true };
}

/**
 * System instruction provided to Gemini Pro for structured transaction extraction.
 */
export const EXTRACTION_SYSTEM_INSTRUCTION = `
You are an expert financial document parser specialized in extracting transaction data from bank statements in Guatemala.
You will receive the sanitized raw text of a bank statement. All personal identifying information (PII) has already been replaced locally with placeholders like [NOMBRE_REDACTADO], [CUENTA_REDACTADA], [DIRECCION_REDACTADA], [IDENTIFICACION_REDACTADA], [CONTACTO_REDACTADO], [DATO_REDACTADO].

CRITICAL EXTRACTION RULES:
1. Extract ONLY expenses and debits (purchases, point-of-sale transactions, debit memos, ATM cash withdrawals, fees, service charges, outgoing transfers).
2. STRICTLY IGNORE credits, deposits, salary income, internet payments to credit cards (e.g. "PAGO POR INTERNET", "PAGO ELECTRONICO"), cashback bonuses (e.g. "CREDITO CASH BACK", "CREDITO P/CARGOS"), and opening/closing balances ("SALDO ANTERIOR", "SALDO FIN DE MES", "TOTALES").
3. STRICTLY IGNORE summary sections (e.g. "BALANCE DE CUENTA", "USO DE CANALES", channel percentages) and non-movement lines.
4. Format each date strictly as "YYYY-MM-DD". If the year is not explicitly written on each line, infer the year and month from the statement period or date markers in the header (e.g., if the statement mentions JULIO/25 or 07/2025, year is 2025 and month is 07; day "01" becomes "2025-07-01").
5. The amount must be a positive number in Guatemalan Quetzales (GTQ / Q) with up to 2 decimal places. Do NOT include currency symbols or thousands commas.
6. The description must be in Spanish, keeping any merchant or movement detail and preserving redaction placeholders intact.
7. Return a STRICT JSON ARRAY of objects matching this exact schema:
[
  {
    "date": "YYYY-MM-DD",
    "description": "string",
    "amount": 0.00
  }
]
Do not include any Markdown fences or explanations. Return only valid JSON.
`.trim();

/**
 * Builds the user prompt sent to the LLM containing the sanitized statement text.
 */
export function buildExtractionPrompt(sanitizedText: string, bankName?: string): string {
  const bankHeader = bankName ? `Banco de origen: ${bankName}\n\n` : "";
  return `${bankHeader}A continuación se presenta el extracto anonimizado del estado de cuenta bancario:\n\n${sanitizedText}`;
}

/**
 * Raw item structure returned by the LLM.
 */
interface RawLLMTransaction {
  date?: string;
  description?: string;
  amount?: number | string;
}

/**
 * Parses and validates the raw JSON string from Gemini Pro into canonical Transaction objects.
 */
export function parseLLMTransactionResponse(rawResponseText: string): Transaction[] {
  if (!rawResponseText || !rawResponseText.trim()) {
    return [];
  }

  // Clean possible markdown code blocks (```json ... ``` or ``` ...)
  let cleanText = rawResponseText.trim();
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  // Sometimes models wrap array in an object { "transactions": [...] }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleanText);
  } catch {
    // Attempt finding bracketed JSON array within text
    const arrayMatch = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      parsedJson = JSON.parse(arrayMatch[0]);
    } else {
      throw new Error("El modelo de IA no devolvió un formato JSON válido.");
    }
  }

  let rawList: RawLLMTransaction[] = [];
  if (Array.isArray(parsedJson)) {
    rawList = parsedJson as RawLLMTransaction[];
  } else if (
    parsedJson &&
    typeof parsedJson === "object" &&
    Array.isArray((parsedJson as { transactions?: RawLLMTransaction[] }).transactions)
  ) {
    rawList = (parsedJson as { transactions: RawLLMTransaction[] }).transactions;
  } else if (
    parsedJson &&
    typeof parsedJson === "object" &&
    Array.isArray((parsedJson as { gastos?: RawLLMTransaction[] }).gastos)
  ) {
    rawList = (parsedJson as { gastos: RawLLMTransaction[] }).gastos;
  } else {
    throw new Error("La respuesta del modelo de IA no contiene un listado de transacciones.");
  }

  const validTransactions: Transaction[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item || typeof item !== "object") continue;

    const rawDate = typeof item.date === "string" ? item.date.trim() : "";
    const rawDesc = typeof item.description === "string" ? item.description.trim() : "";
    const numAmount =
      typeof item.amount === "number"
        ? item.amount
        : typeof item.amount === "string"
        ? parseFloat(item.amount.replace(/[^0-9.-]/g, ""))
        : NaN;

    // Validate date format (YYYY-MM-DD)
    const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
    const isValidDesc = rawDesc.length > 0;
    const isValidAmount = !isNaN(numAmount) && numAmount > 0;

    if (isValidDate && isValidDesc && isValidAmount) {
      validTransactions.push({
        id: `llm-tx-${i + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        date: rawDate,
        description: rawDesc,
        amount: Math.round(numAmount * 100) / 100,
        currency: "GTQ",
        classificationSource: "llm",
      });
    }
  }

  return validTransactions;
}

/**
 * Server-side function that calls Google Gemini Pro using `@google/genai`
 * with the sanitized text payload.
 */
export async function extractTransactionsWithGemini(
  sanitizedText: string,
  bankName?: string,
  apiKey?: string
): Promise<{
  transactions: Transaction[];
  summary: CSVParsingSummary;
}> {
  // 1. Boundary check: ensure no unredacted identity data is sent
  const validation = validateSanitizedPayload(sanitizedText);
  if (!validation.isValid) {
    throw new Error(validation.reason || "El texto no cumple con los requisitos de privacidad.");
  }

  // 2. Retrieve API Key securely on the server
  const activeKey = apiKey || process.env.GEMINI_API_KEY;
  if (!activeKey || !activeKey.trim()) {
    throw new Error(
      "No se ha configurado la clave GEMINI_API_KEY en las variables de entorno del servidor. Configure su clave en .env.local para continuar."
    );
  }

  // 3. Initialize GoogleGenAI SDK
  const ai = new GoogleGenAI({ apiKey: activeKey.trim() });
  const prompt = buildExtractionPrompt(sanitizedText, bankName);

  // Available pro models with graceful fallback if specific version is unavailable
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
          systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
        },
      });

      if (response && response.text) {
        rawResponseText = response.text;
        break;
      }
    } catch (err) {
      lastError = err;
      // If error is model not found or unsupported, attempt next candidate model
      console.warn(`Error al intentar modelo ${model}:`, err);
    }
  }

  if (!rawResponseText) {
    const errorMsg =
      lastError instanceof Error ? lastError.message : "Error desconocido al llamar a Gemini Pro";
    throw new Error(`Error al comunicarse con Gemini Pro: ${errorMsg}`);
  }

  // 4. Parse structured JSON from model response
  const transactions = parseLLMTransactionResponse(rawResponseText);

  // 5. Build summary
  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const summary: CSVParsingSummary = {
    totalRowsProcessed: transactions.length,
    validTransactionsCount: transactions.length,
    skippedRowsCount: 0,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };

  return { transactions, summary };
}
