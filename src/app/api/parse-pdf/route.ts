import { NextRequest, NextResponse } from "next/server";
import { parsePDFStatement } from "@/lib/pdf-parser";


/**
 * Local Next.js API Route Handler for extracting PDF statements.
 * Strictly processed on the local server without sending any data to external APIs.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: "No se proporcionó ningún archivo PDF válido." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const result = await parsePDFStatement(uint8Array);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error al procesar PDF en el servidor local:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          "Ocurrió un error inesperado al procesar el estado de cuenta PDF de forma local.",
      },
      { status: 500 }
    );
  }
}
