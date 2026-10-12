import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, parseCurrency } from "./currency";

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
