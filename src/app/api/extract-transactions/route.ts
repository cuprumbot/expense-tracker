import { NextRequest, NextResponse } from "next/server";
import {
  extractTransactionsWithGemini,
  validateSanitizedPayload,
} from "@/lib/llm-extractor";
import { classifyTransactions } from "@/lib/expense-classifier";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sanitizedText, bankName } = body;

    if (!sanitizedText || typeof sanitizedText !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "No se proporcionó el texto anonimizado del estado de cuenta.",
        },
        { status: 400 }
      );
    }

    // Split-Brain Boundary: Verify no unredacted identity data is in the payload
    const validation = validateSanitizedPayload(sanitizedText);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error:
            validation.reason ||
            "Se detectaron posibles datos no anonimizados en el texto. Por favor revise la anonimización antes de enviar.",
        },
        { status: 400 }
      );
    }

    // Call Gemini Pro securely on the server
    const result = await extractTransactionsWithGemini(sanitizedText, bankName);
    const categorizedTransactions = classifyTransactions(result.transactions);

    return NextResponse.json({
      success: true,
      transactions: categorizedTransactions,
      summary: result.summary,
    });
  } catch (error) {
    console.error("Error en /api/extract-transactions:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Ocurrió un error inesperado al extraer las transacciones con Gemini Pro.";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
