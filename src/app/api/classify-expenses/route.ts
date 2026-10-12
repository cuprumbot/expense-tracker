import { NextRequest, NextResponse } from "next/server";
import {
  classifyExpensesWithGemini,
  validateExpenseClassificationPayload,
  ClassifyExpensesPayload,
} from "@/lib/llm-classifier";

/**
 * Server-side Route Handler for classifying pending expenses with Gemini Pro.
 * Split-Brain boundary: Receives ONLY sanitized descriptions and amounts, never PII.
 */
export async function POST(req: NextRequest) {
  try {
    const body: ClassifyExpensesPayload = await req.json();

    // 1. Split-Brain boundary check: ensure only descriptions and amounts, zero PII
    const validation = validateExpenseClassificationPayload(body);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error:
            validation.reason ||
            "Los datos enviados para clasificación no cumplen con los requisitos de seguridad.",
        },
        { status: 400 }
      );
    }

    // 2. Call Gemini Pro with candidate models
    const classifications = await classifyExpensesWithGemini(
      body.unclassifiedTransactions,
      body.availableCategories
    );

    return NextResponse.json({
      success: true,
      classifications,
      count: classifications.length,
    });
  } catch (error) {
    console.error("Error en /api/classify-expenses:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Ocurrió un error inesperado al clasificar los gastos con Gemini Pro.";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
