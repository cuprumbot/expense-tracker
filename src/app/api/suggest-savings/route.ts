import { NextRequest, NextResponse } from "next/server";
import {
  generateSavingsSuggestionsWithGemini,
  validateSavingsPayload,
  SavingsPayload,
} from "@/lib/savings-advisor";

/**
 * Server-side Route Handler for requesting spending reduction recommendations with Gemini Pro.
 * Split-Brain boundary: Receives ONLY aggregated category totals and detailed recurring services.
 * Zero personal identifying information (PII) or non-recurring transaction lines.
 */
export async function POST(req: NextRequest) {
  try {
    const body: SavingsPayload = await req.json();

    // 1. Split-Brain boundary check: validate that payload conforms strictly to aggregated contract
    const validation = validateSavingsPayload(body);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error:
            validation.reason ||
            "Los datos enviados para el análisis de ahorro no cumplen con las reglas de privacidad y formato.",
        },
        { status: 400 }
      );
    }

    // 2. Call Gemini Pro to generate structured savings recommendations
    const recommendations = await generateSavingsSuggestionsWithGemini(body);

    return NextResponse.json({
      success: true,
      recommendations,
    });
  } catch (error) {
    console.error("Error en /api/suggest-savings:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Ocurrió un error inesperado al generar las sugerencias de ahorro con Gemini Pro.";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
