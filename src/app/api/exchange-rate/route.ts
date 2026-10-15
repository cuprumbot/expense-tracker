import { NextResponse } from "next/server";
import { getExchangeRate, DEFAULT_USD_TO_GTQ_RATE } from "@/lib/currency";

/**
 * GET /api/exchange-rate
 * Returns the currently active USD to GTQ exchange rate.
 * Conforms to US-021 acceptance criteria.
 */
export async function GET() {
  const rate = getExchangeRate();

  return NextResponse.json({
    rate,
    baseCurrency: "USD",
    targetCurrency: "GTQ",
    defaultRate: DEFAULT_USD_TO_GTQ_RATE,
  });
}
