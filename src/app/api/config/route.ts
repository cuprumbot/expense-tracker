import { NextResponse } from "next/server";
import { getExchangeRate, DEFAULT_USD_TO_GTQ_RATE } from "@/lib/currency";
import { getUnclassifiedThreshold } from "@/lib/expense-classifier";

/**
 * GET /api/config
 * Provides runtime server configuration to the client without exposing secrets.
 * Adheres to Option A: Single Source of Truth via server API.
 */
export async function GET() {
  return NextResponse.json({
    exchangeRate: {
      rate: getExchangeRate(),
      baseCurrency: "USD",
      targetCurrency: "GTQ",
      defaultRate: DEFAULT_USD_TO_GTQ_RATE,
    },
    unclassifiedThreshold: getUnclassifiedThreshold(),
  });
}
