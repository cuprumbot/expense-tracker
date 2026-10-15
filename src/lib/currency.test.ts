import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatCurrency,
  parseCurrency,
  getExchangeRate,
  convertUsdToGtq,
} from "./currency";

describe("formatCurrency", () => {
  it("formats positive numbers with thousands separators and 2 decimal places", () => {
    assert.strictEqual(formatCurrency(1250.5), "Q 1,250.50");
    assert.strictEqual(formatCurrency(1000000), "Q 1,000,000.00");
    assert.strictEqual(formatCurrency(99.99), "Q 99.99");
  });

  it("formats zero correctly", () => {
    assert.strictEqual(formatCurrency(0), "Q 0.00");
  });

  it("formats negative numbers with a leading negative sign", () => {
    assert.strictEqual(formatCurrency(-45.2), "-Q 45.20");
    assert.strictEqual(formatCurrency(-1500), "-Q 1,500.00");
  });

  it("handles NaN or invalid numbers gracefully", () => {
    assert.strictEqual(formatCurrency(NaN), "Q 0.00");
    // @ts-expect-error test invalid types
    assert.strictEqual(formatCurrency(null), "Q 0.00");
    // @ts-expect-error test invalid types
    assert.strictEqual(formatCurrency(undefined), "Q 0.00");
  });
});

describe("parseCurrency", () => {
  it("parses numbers from strings containing Q and GTQ symbols", () => {
    assert.strictEqual(parseCurrency("Q 1,250.50"), 1250.5);
    assert.strictEqual(parseCurrency("GTQ 350.00"), 350);
    assert.strictEqual(parseCurrency("Q100.25"), 100.25);
  });

  it("handles negative amounts and parentheses format", () => {
    assert.strictEqual(parseCurrency("-Q 45.20"), -45.2);
    assert.strictEqual(parseCurrency("(1,500.00)"), -1500);
  });

  it("returns numeric values if input is already number", () => {
    assert.strictEqual(parseCurrency(250.75), 250.75);
    assert.strictEqual(parseCurrency(0), 0);
  });

  it("returns 0 for empty or invalid strings", () => {
    assert.strictEqual(parseCurrency(""), 0);
    assert.strictEqual(parseCurrency("invalid"), 0);
  });
});

describe("US-021: getExchangeRate & convertUsdToGtq", () => {
  it("getExchangeRate returns default rate of 7.85 when env var is not set", () => {
    const originalEnv = process.env.USD_GTQ_EXCHANGE_RATE;
    try {
      delete process.env.USD_GTQ_EXCHANGE_RATE;
      assert.strictEqual(getExchangeRate(), 7.85);
    } finally {
      process.env.USD_GTQ_EXCHANGE_RATE = originalEnv;
    }
  });

  it("getExchangeRate respects valid USD_GTQ_EXCHANGE_RATE environment variable", () => {
    const originalEnv = process.env.USD_GTQ_EXCHANGE_RATE;
    try {
      process.env.USD_GTQ_EXCHANGE_RATE = "8.125";
      assert.strictEqual(getExchangeRate(), 8.125);
    } finally {
      process.env.USD_GTQ_EXCHANGE_RATE = originalEnv;
    }
  });

  it("getExchangeRate falls back to 7.85 if environment variable is invalid or non-positive", () => {
    const originalEnv = process.env.USD_GTQ_EXCHANGE_RATE;
    try {
      process.env.USD_GTQ_EXCHANGE_RATE = "invalid-number";
      assert.strictEqual(getExchangeRate(), 7.85);

      process.env.USD_GTQ_EXCHANGE_RATE = "-5.0";
      assert.strictEqual(getExchangeRate(), 7.85);

      process.env.USD_GTQ_EXCHANGE_RATE = "0";
      assert.strictEqual(getExchangeRate(), 7.85);
    } finally {
      process.env.USD_GTQ_EXCHANGE_RATE = originalEnv;
    }
  });

  it("convertUsdToGtq converts amounts accurately at default exchange rate (7.85)", () => {
    const originalEnv = process.env.USD_GTQ_EXCHANGE_RATE;
    try {
      delete process.env.USD_GTQ_EXCHANGE_RATE;

      assert.strictEqual(convertUsdToGtq(1), 7.85);
      assert.strictEqual(convertUsdToGtq(100), 785);
      // 24.99 * 7.85 = 196.1715 -> rounds to 196.17
      assert.strictEqual(convertUsdToGtq(24.99), 196.17);
      // 6.99 * 7.85 = 54.8715 -> rounds to 54.87
      assert.strictEqual(convertUsdToGtq(6.99), 54.87);
    } finally {
      process.env.USD_GTQ_EXCHANGE_RATE = originalEnv;
    }
  });

  it("convertUsdToGtq handles zero and negative numbers properly", () => {
    assert.strictEqual(convertUsdToGtq(0), 0);
    // Negative amounts (refunds / debit adjustments)
    // -15.50 * 7.85 = -121.675 -> rounds to -121.68
    assert.strictEqual(convertUsdToGtq(-15.5, 7.85), -121.68);
  });

  it("convertUsdToGtq supports and validates customRate override", () => {
    // With customRate = 8.00
    assert.strictEqual(convertUsdToGtq(50, 8.0), 400.0);
    // Invalid customRate (<= 0 or NaN) falls back to system rate (7.85)
    assert.strictEqual(convertUsdToGtq(100, -2.5), 785.0);
    assert.strictEqual(convertUsdToGtq(100, 0), 785.0);
    assert.strictEqual(convertUsdToGtq(100, NaN), 785.0);
  });

  it("convertUsdToGtq handles invalid or non-numeric amounts gracefully", () => {
    assert.strictEqual(convertUsdToGtq(NaN), 0);
    // @ts-expect-error test invalid types
    assert.strictEqual(convertUsdToGtq(null), 0);
    // @ts-expect-error test invalid types
    assert.strictEqual(convertUsdToGtq(undefined), 0);
  });

  it("convertUsdToGtq handles large values without precision degradation", () => {
    assert.strictEqual(convertUsdToGtq(1000000, 7.85), 7850000);
  });
});
