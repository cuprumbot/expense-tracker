import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GET as getExchangeRateRoute } from "@/app/api/exchange-rate/route";
import { GET as getConfigRoute } from "@/app/api/config/route";

describe("API Route: /api/exchange-rate", () => {
  it("returns 200 with exchange rate data and expected metadata", async () => {
    const originalEnv = process.env.USD_GTQ_EXCHANGE_RATE;
    try {
      process.env.USD_GTQ_EXCHANGE_RATE = "7.85";
      const response = await getExchangeRateRoute();
      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.strictEqual(data.rate, 7.85);
      assert.strictEqual(data.baseCurrency, "USD");
      assert.strictEqual(data.targetCurrency, "GTQ");
      assert.strictEqual(data.defaultRate, 7.85);
    } finally {
      process.env.USD_GTQ_EXCHANGE_RATE = originalEnv;
    }
  });

  it("dynamically reflects updated server environment variable without rebuild", async () => {
    const originalEnv = process.env.USD_GTQ_EXCHANGE_RATE;
    try {
      process.env.USD_GTQ_EXCHANGE_RATE = "8.20";
      const response = await getExchangeRateRoute();
      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.strictEqual(data.rate, 8.2);
    } finally {
      process.env.USD_GTQ_EXCHANGE_RATE = originalEnv;
    }
  });
});

describe("API Route: /api/config", () => {
  it("returns consolidated runtime configuration", async () => {
    const origRate = process.env.USD_GTQ_EXCHANGE_RATE;
    const origThresh = process.env.UNCLASSIFIED_EXPENSES_THRESHOLD;
    try {
      process.env.USD_GTQ_EXCHANGE_RATE = "7.95";
      process.env.UNCLASSIFIED_EXPENSES_THRESHOLD = "12";

      const response = await getConfigRoute();
      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.strictEqual(data.exchangeRate.rate, 7.95);
      assert.strictEqual(data.exchangeRate.baseCurrency, "USD");
      assert.strictEqual(data.exchangeRate.targetCurrency, "GTQ");
      assert.strictEqual(data.unclassifiedThreshold, 12);
    } finally {
      process.env.USD_GTQ_EXCHANGE_RATE = origRate;
      process.env.UNCLASSIFIED_EXPENSES_THRESHOLD = origThresh;
    }
  });
});
