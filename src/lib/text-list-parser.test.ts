import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseSimpleExpenseList,
  parseSimpleExpenseLine,
  getLocalTodayDateString,
} from "./text-list-parser";
import { classifyTransactions, matchMerchantCategory } from "./expense-classifier";
import { saveStoredSession, loadStoredSession, clearStoredSession } from "./storage";

describe("US-052: Context-Aware Simple Expense List Parser & Numeric Merchant Disambiguation", () => {
  const fixedDate = "2026-10-30";

  it("recognizes 'super 24' in merchant-catalog.json under Supermercado", () => {
    const match1 = matchMerchantCategory("super 24");
    assert.equal(match1.category, "Supermercado");
    assert.equal(match1.source, "local");

    const match2 = matchMerchantCategory("Super 24 Zona 10");
    assert.equal(match2.category, "Supermercado");
    assert.equal(match2.source, "local");
  });

  it("correctly parses lines where the vendor precedes the amount", () => {
    const input = `
      Walmart 150
      Cemaco 200
      gasolina 90
    `;

    const result = parseSimpleExpenseList(input, fixedDate);
    assert.equal(result.success, true);
    assert.equal(result.transactions.length, 3);
    assert.equal(result.summary.validTransactionsCount, 3);
    assert.equal(result.summary.skippedLinesCount, 0);
    assert.equal(result.summary.totalAmount, 440);

    assert.equal(result.transactions[0].description, "Walmart");
    assert.equal(result.transactions[0].amount, 150);
    assert.equal(result.transactions[0].currency, "GTQ");
    assert.equal(result.transactions[0].date, fixedDate);

    assert.equal(result.transactions[1].description, "Cemaco");
    assert.equal(result.transactions[1].amount, 200);
    assert.equal(result.transactions[1].currency, "GTQ");

    assert.equal(result.transactions[2].description, "gasolina");
    assert.equal(result.transactions[2].amount, 90);
    assert.equal(result.transactions[2].currency, "GTQ");
  });

  it("correctly parses lines where the amount precedes the vendor", () => {
    const input = `
      150 Burger king
      50 Taco bell
      50 dollarcity
    `;

    const result = parseSimpleExpenseList(input, fixedDate);
    assert.equal(result.success, true);
    assert.equal(result.transactions.length, 3);
    assert.equal(result.summary.validTransactionsCount, 3);
    assert.equal(result.summary.totalAmount, 250);

    assert.equal(result.transactions[0].description, "Burger king");
    assert.equal(result.transactions[0].amount, 150);
    assert.equal(result.transactions[0].currency, "GTQ");

    assert.equal(result.transactions[1].description, "Taco bell");
    assert.equal(result.transactions[1].amount, 50);
    assert.equal(result.transactions[1].currency, "GTQ");

    assert.equal(result.transactions[2].description, "dollarcity");
    assert.equal(result.transactions[2].amount, 50);
    assert.equal(result.transactions[2].currency, "GTQ");
  });

  it("disambiguates numeric vendor names like 'super 24' in both '40 super 24' and 'super 24 20'", () => {
    const batch1 = parseSimpleExpenseList("50 dollarcity\n40 super 24", fixedDate);
    assert.equal(batch1.success, true);
    assert.equal(batch1.transactions.length, 2);

    assert.equal(batch1.transactions[0].description, "dollarcity");
    assert.equal(batch1.transactions[0].amount, 50);

    assert.equal(batch1.transactions[1].description, "super 24");
    assert.equal(batch1.transactions[1].amount, 40);
    assert.equal(batch1.transactions[1].currency, "GTQ");

    const batch2 = parseSimpleExpenseList("gasolina 90\nsuper 24 20", fixedDate);
    assert.equal(batch2.success, true);
    assert.equal(batch2.transactions.length, 2);

    assert.equal(batch2.transactions[0].description, "gasolina");
    assert.equal(batch2.transactions[0].amount, 90);

    assert.equal(batch2.transactions[1].description, "super 24");
    assert.equal(batch2.transactions[1].amount, 20);
    assert.equal(batch2.transactions[1].currency, "GTQ");

    // Verify local classification works seamlessly on the disambiguated transactions
    const classified = classifyTransactions(batch2.transactions);
    assert.equal(classified[0].category, "Transporte y Combustible");
    assert.equal(classified[1].category, "Supermercado");
  });

  it("disambiguates additional numeric merchants and location suffixes (Forever 21, 7 Eleven, Zona 10)", () => {
    const line1 = parseSimpleExpenseLine("350 Forever 21", fixedDate);
    assert.ok(line1);
    assert.equal(line1.description, "Forever 21");
    assert.equal(line1.amount, 350);

    const line2 = parseSimpleExpenseLine("Forever 21 350", fixedDate);
    assert.ok(line2);
    assert.equal(line2.description, "Forever 21");
    assert.equal(line2.amount, 350);

    const line3 = parseSimpleExpenseLine("7 eleven 45", fixedDate);
    assert.ok(line3);
    assert.equal(line3.description, "7 eleven");
    assert.equal(line3.amount, 45);

    const line4 = parseSimpleExpenseLine("45 7 eleven", fixedDate);
    assert.ok(line4);
    assert.equal(line4.description, "7 eleven");
    assert.equal(line4.amount, 45);

    const line5 = parseSimpleExpenseLine("180 La Torre Zona 10", fixedDate);
    assert.ok(line5);
    assert.equal(line5.description, "La Torre Zona 10");
    assert.equal(line5.amount, 180);
  });

  it("supports decimal amounts and optional currency prefixes/suffixes (Q, GTQ, $, USD)", () => {
    const input = `
      Walmart Q 125.50
      Q85.25 Farmacia Galeno
      Netflix $10
      20 USD Amazon
      Pollo Campero 146.75 GTQ
    `;

    const result = parseSimpleExpenseList(input, fixedDate, 7.85);
    assert.equal(result.success, true);
    assert.equal(result.transactions.length, 5);

    assert.equal(result.transactions[0].description, "Walmart");
    assert.equal(result.transactions[0].amount, 125.5);
    assert.equal(result.transactions[0].originalCurrency, undefined);

    assert.equal(result.transactions[1].description, "Farmacia Galeno");
    assert.equal(result.transactions[1].amount, 85.25);

    assert.equal(result.transactions[2].description, "Netflix");
    assert.equal(result.transactions[2].amount, 78.5);
    assert.equal(result.transactions[2].originalCurrency, "USD");
    assert.equal(result.transactions[2].originalAmount, 10);
    assert.equal(result.transactions[2].exchangeRateApplied, 7.85);

    assert.equal(result.transactions[3].description, "Amazon");
    assert.equal(result.transactions[3].amount, 157);
    assert.equal(result.transactions[3].originalCurrency, "USD");
    assert.equal(result.transactions[3].originalAmount, 20);

    assert.equal(result.transactions[4].description, "Pollo Campero");
    assert.equal(result.transactions[4].amount, 146.75);
  });

  it("assigns the current local upload date when no date is provided", () => {
    const expectedToday = getLocalTodayDateString();
    const result = parseSimpleExpenseList("Walmart 150\n150 Burger king");
    assert.equal(result.success, true);
    assert.equal(result.transactions[0].date, expectedToday);
    assert.equal(result.transactions[1].date, expectedToday);
  });

  it("ignores blank lines and tracks skipped invalid lines in the summary", () => {
    const input = `
      Walmart 150

      Linea sin numeros valida
      12345
      super 24 20
      
    `;

    const result = parseSimpleExpenseList(input, fixedDate);
    assert.equal(result.success, true);
    assert.equal(result.transactions.length, 2);
    assert.equal(result.summary.validTransactionsCount, 2);
    assert.equal(result.summary.skippedLinesCount, 2);
    assert.deepEqual(result.summary.skippedLines, [
      "Linea sin numeros valida",
      "12345",
    ]);
    assert.equal(result.summary.totalAmount, 170);
  });

  it("returns an error in Spanish when the input is empty or contains zero valid transactions", () => {
    const emptyResult = parseSimpleExpenseList("   \n  ");
    assert.equal(emptyResult.success, false);
    assert.equal(emptyResult.transactions.length, 0);
    assert.ok(emptyResult.error?.includes("vacía"));

    const invalidOnlyResult = parseSimpleExpenseList("Solo texto\n99999");
    assert.equal(invalidOnlyResult.success, false);
    assert.equal(invalidOnlyResult.transactions.length, 0);
    assert.equal(invalidOnlyResult.summary.skippedLinesCount, 2);
    assert.ok(invalidOnlyResult.error?.includes("No se encontraron gastos válidos"));
  });

  it("US-053 pipeline: appends text list transactions to previous session transactions without replacing them", () => {
    // Simulate a previously saved session with existing transactions
    const existing = classifyTransactions([
      {
        id: "existing-1",
        date: "2026-10-15",
        description: "Walmart",
        amount: 150,
        currency: "GTQ",
      },
      {
        id: "existing-2",
        date: "2026-10-16",
        description: "Pollo Campero",
        amount: 95,
        currency: "GTQ",
      },
    ]);

    const rawList = `
      Walmart 150
      150 Burger king
      40 super 24
      gasolina 90
    `;

    const parsed = parseSimpleExpenseList(rawList, fixedDate);
    assert.equal(parsed.success, true);
    assert.equal(parsed.transactions.length, 4);

    const classifiedNew = classifyTransactions(parsed.transactions);
    assert.equal(classifiedNew[0].category, "Supermercado"); // Walmart
    assert.equal(classifiedNew[1].category, "Restaurantes y Cafés"); // Burger king
    assert.equal(classifiedNew[2].category, "Supermercado"); // super 24
    assert.equal(classifiedNew[3].category, "Transporte y Combustible"); // gasolina

    // Append to existing session transactions (never replacing previous ones)
    const combined = [...existing, ...classifiedNew];
    assert.equal(combined.length, 6);
    const total = combined.reduce((sum, tx) => sum + tx.amount, 0);
    assert.equal(total, 675);
  });
});

