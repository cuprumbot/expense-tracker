import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isCategoryEssential,
  TIERED_AMOUNT_PRESETS,
  getCategoryHistoricalStats,
  getBudgetForMonth,
} from "./budget-engine";
import { Transaction } from "@/types/transaction";

describe("US-056: Budget Category Tiers & Historical Context Helpers", () => {
  it("correctly identifies essential living categories vs discretionary categories", () => {
    assert.strictEqual(isCategoryEssential("supermercado", "Supermercado"), true);
    assert.strictEqual(isCategoryEssential("servicios", "Servicios Básicos"), true);
    assert.strictEqual(isCategoryEssential("transporte", "Transporte y Combustible"), true);
    assert.strictEqual(isCategoryEssential("salud", "Salud y Farmacia"), true);
    assert.strictEqual(isCategoryEssential("educacion", "Educación y Librerías"), true);
    assert.strictEqual(isCategoryEssential("visacuotas_financiamiento", "Visacuotas y Financiamiento"), true);
    assert.strictEqual(isCategoryEssential("hogar", "Hogar y Mascotas"), true);

    // Discretionary
    assert.strictEqual(isCategoryEssential("restaurantes", "Restaurantes y Cafés"), false);
    assert.strictEqual(isCategoryEssential("entretenimiento", "Entretenimiento y Compras"), false);
    assert.strictEqual(isCategoryEssential("suscripciones", "Suscripciones"), false);
    assert.strictEqual(isCategoryEssential("tecnologia", "Tecnología y Computación"), false);
  });

  it("provides higher tiered amount suggestions for essentials than for discretionary", () => {
    assert.ok(TIERED_AMOUNT_PRESETS.essential[0] >= 1000);
    assert.ok(TIERED_AMOUNT_PRESETS.discretionary[0] <= 200);
    assert.ok(
      TIERED_AMOUNT_PRESETS.essential[TIERED_AMOUNT_PRESETS.essential.length - 1] >
        TIERED_AMOUNT_PRESETS.discretionary[TIERED_AMOUNT_PRESETS.discretionary.length - 1]
    );
  });

  it("calculates accurate historical stats when transactions exist for a category", () => {
    const mockTxs: Transaction[] = [
      {
        id: "tx-1",
        date: "2026-08-05",
        description: "Supermercado La Torre",
        amount: 800,
        currency: "GTQ",
        category: "Supermercado",
      },
      {
        id: "tx-2",
        date: "2026-08-20",
        description: "Supermercado Walmart",
        amount: 1200,
        currency: "GTQ",
        category: "Supermercado",
      },
      {
        id: "tx-3",
        date: "2026-09-10",
        description: "Supermercado Paiz",
        amount: 1500,
        currency: "GTQ",
        category: "Supermercado",
      },
    ];

    const stats = getCategoryHistoricalStats(mockTxs, "Supermercado");
    assert.ok(stats);
    // Month 2026-08 = 2000, Month 2026-09 = 1500. Average = (2000 + 1500) / 2 = 1750
    assert.strictEqual(stats.averageMonthlyGTQ, 1750);
    // Last month (2026-09) = 1500
    assert.strictEqual(stats.lastMonthGTQ, 1500);
    // Goal -10% = 1750 * 0.9 = 1575
    assert.strictEqual(stats.goalMinus10GTQ, 1575);
  });

  it("returns null when no transactions exist for the requested category", () => {
    const stats = getCategoryHistoricalStats([], "Supermercado");
    assert.strictEqual(stats, null);
  });
});
