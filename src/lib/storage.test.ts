import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  saveStoredSession,
  loadStoredSession,
  clearStoredSession,
  clearStoredSessionOnly,
  saveStoredCategories,
  loadStoredCategories,
  saveStoredHiddenVendors,
  loadStoredHiddenVendors,
  saveStoredHideBothPanelsConfig,
  loadStoredHideBothPanelsConfig,
  loadStoredPanelDimensions,
  saveStoredPanelDimensions,
  resetStoredPanelDimensions,
  DEFAULT_PANEL_DIMENSIONS,
  STORAGE_KEY_PANEL_DIMENSIONS,
  STORAGE_KEY_SESSION,
  STORAGE_KEY_CATEGORIES,
  STORAGE_KEY_BUDGET,
  saveStoredBudgetState,
  loadStoredBudgetState,
  clearStoredBudgetState,
  getBudgetForMonth,
} from "./storage";
import { Transaction, CSVParsingSummary, CustomCategory } from "@/types/transaction";
import { StoredBudgetState, BudgetPlan } from "@/types/budget";

// Mock localStorage in global scope for unit testing
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe("US-011: LocalStorage Persistence Unit Tests", () => {
  let mockStore: MockLocalStorage;

  beforeEach(() => {
    mockStore = new MockLocalStorage();
    (globalThis as unknown as { window: { localStorage: MockLocalStorage } }).window = {
      localStorage: mockStore,
    };
  });

  const sampleTransactions: Transaction[] = [
    {
      id: "tx-1",
      date: "2026-09-01",
      description: "Supermercado La Torre",
      amount: 150.5,
      currency: "GTQ",
      category: "Supermercado",
      classificationSource: "local",
    },
  ];

  const sampleSummary: CSVParsingSummary = {
    totalRowsProcessed: 1,
    validTransactionsCount: 1,
    skippedRowsCount: 0,
    totalAmount: 150.5,
  };

  const sampleCustomCategories: CustomCategory[] = [
    {
      id: "cat-1",
      name: "Mascotas",
      color: "#10b981",
    },
  ];

  it("saves and loads a valid session correctly", () => {
    const saved = saveStoredSession({
      transactions: sampleTransactions,
      summary: sampleSummary,
      customCategories: sampleCustomCategories,
      sourceLabel: "demo.csv",
      bankName: "Banco G&T Continental",
    });

    assert.equal(saved, true);

    const loaded = loadStoredSession();
    assert.ok(loaded);
    assert.equal(loaded.version, 1);
    assert.equal(loaded.transactions.length, 1);
    assert.equal(loaded.transactions[0].description, "Supermercado La Torre");
    assert.equal(loaded.summary.totalAmount, 150.5);
    assert.equal(loaded.customCategories.length, 1);
    assert.equal(loaded.customCategories[0].name, "Mascotas");
    assert.equal(loaded.sourceLabel, "demo.csv");
    assert.equal(loaded.bankName, "Banco G&T Continental");
    assert.ok(loaded.savedAt);
  });

  it("handles corrupted JSON gracefully without crashing and clears corrupted state", () => {
    // Inject corrupt JSON into storage
    mockStore.setItem(STORAGE_KEY_SESSION, "INVALID_CORRUPTED_JSON_STRING{{{");

    const loaded = loadStoredSession();
    assert.equal(loaded, null);
    // Verified that corrupted entry was cleaned up
    assert.equal(mockStore.getItem(STORAGE_KEY_SESSION), null);
  });

  it("handles malformed object structure missing transactions or summary gracefully", () => {
    // Valid JSON but invalid structure
    mockStore.setItem(STORAGE_KEY_SESSION, JSON.stringify({ notASession: true }));

    const loaded = loadStoredSession();
    assert.equal(loaded, null);
    assert.equal(mockStore.getItem(STORAGE_KEY_SESSION), null);
  });

  it("clears stored session and categories on clearStoredSession", () => {
    saveStoredSession({
      transactions: sampleTransactions,
      summary: sampleSummary,
      customCategories: sampleCustomCategories,
    });
    saveStoredCategories(sampleCustomCategories);

    assert.ok(mockStore.getItem(STORAGE_KEY_SESSION));
    assert.ok(mockStore.getItem(STORAGE_KEY_CATEGORIES));

    const cleared = clearStoredSession();
    assert.equal(cleared, true);
    assert.equal(mockStore.getItem(STORAGE_KEY_SESSION), null);
    assert.equal(mockStore.getItem(STORAGE_KEY_CATEGORIES), null);
  });

  it("persists and restores custom categories independently", () => {
    saveStoredCategories(sampleCustomCategories);
    const loaded = loadStoredCategories();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].name, "Mascotas");

    // Test corrupted categories
    mockStore.setItem(STORAGE_KEY_CATEGORIES, "not-an-array");
    const fallback = loadStoredCategories();
    assert.deepEqual(fallback, []);
  });

  it("handles quota exceeded error gracefully when saving", () => {
    // Override setItem to simulate QuotaExceededError
    mockStore.setItem = () => {
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    };

    const saved = saveStoredSession({
      transactions: sampleTransactions,
      summary: sampleSummary,
      customCategories: sampleCustomCategories,
    });

    assert.equal(saved, false);
  });

  describe("US-027: Session State Continuity and Explicit Session Reset Unit Tests", () => {
    it("clears session transactions from localStorage but strictly preserves custom categories when wipeCategories is false", () => {
      saveStoredSession({
        transactions: sampleTransactions,
        summary: sampleSummary,
        customCategories: sampleCustomCategories,
      });
      saveStoredCategories(sampleCustomCategories);

      assert.ok(mockStore.getItem(STORAGE_KEY_SESSION));
      assert.ok(mockStore.getItem(STORAGE_KEY_CATEGORIES));

      // US-027 explicit session reset without factory wipe
      const result = clearStoredSession(false);
      assert.equal(result, true);

      // Session transactions are removed
      assert.equal(mockStore.getItem(STORAGE_KEY_SESSION), null);
      assert.equal(loadStoredSession(), null);

      // Custom categories remain fully intact
      assert.ok(mockStore.getItem(STORAGE_KEY_CATEGORIES));
      const preservedCategories = loadStoredCategories();
      assert.equal(preservedCategories.length, 1);
      assert.equal(preservedCategories[0].name, "Mascotas");
    });

    it("clearStoredSessionOnly helper clears session and keeps custom categories intact", () => {
      saveStoredSession({
        transactions: sampleTransactions,
        summary: sampleSummary,
        customCategories: sampleCustomCategories,
      });
      saveStoredCategories(sampleCustomCategories);

      const result = clearStoredSessionOnly();
      assert.equal(result, true);

      assert.equal(mockStore.getItem(STORAGE_KEY_SESSION), null);
      assert.equal(loadStoredCategories().length, 1);
    });

    it("wipes both session and custom categories when wipeCategories is true (factory reset option)", () => {
      saveStoredSession({
        transactions: sampleTransactions,
        summary: sampleSummary,
        customCategories: sampleCustomCategories,
      });
      saveStoredCategories(sampleCustomCategories);

      const result = clearStoredSession(true);
      assert.equal(result, true);

      assert.equal(mockStore.getItem(STORAGE_KEY_SESSION), null);
      assert.equal(mockStore.getItem(STORAGE_KEY_CATEGORIES), null);
      assert.deepEqual(loadStoredCategories(), []);
    });

    it("preserves customized existing transactions when appending newly uploaded items to session", () => {
      // Existing session with user custom edits (manual category reassignment and subscription toggle)
      const existingSessionTransactions: Transaction[] = [
        {
          id: "tx-existing-1",
          date: "2026-08-01",
          description: "Gasto Especial Modificado",
          amount: 250.0,
          currency: "GTQ",
          category: "Mascotas", // user manual reassignment
          classificationSource: "manual",
          isSubscription: true, // user subscription toggle
        },
      ];

      // Newly uploaded file incoming transactions
      const incomingTransactions: Transaction[] = [
        {
          id: "tx-incoming-2",
          date: "2026-08-15",
          description: "Supermercado Paiz",
          amount: 180.0,
          currency: "GTQ",
          category: "Supermercado",
          classificationSource: "local",
        },
      ];

      // Appending incoming transactions to existing
      const combined = [...existingSessionTransactions, ...incomingTransactions];
      const combinedTotal = combined.reduce((acc, t) => acc + t.amount, 0);

      // Verify custom edits on existing transactions remain completely untouched
      assert.equal(combined.length, 2);
      assert.equal(combined[0].id, "tx-existing-1");
      assert.equal(combined[0].category, "Mascotas");
      assert.equal(combined[0].classificationSource, "manual");
      assert.equal(combined[0].isSubscription, true);

      // Verify new transaction is appended
      assert.equal(combined[1].id, "tx-incoming-2");
      assert.equal(combined[1].category, "Supermercado");
      assert.equal(combinedTotal, 430.0);

      // Persist combined session to storage
      saveStoredSession({
        transactions: combined,
        summary: {
          totalRowsProcessed: combined.length,
          validTransactionsCount: combined.length,
          skippedRowsCount: 0,
          totalAmount: combinedTotal,
        },
        customCategories: sampleCustomCategories,
      });

      const loaded = loadStoredSession();
      assert.ok(loaded);
      assert.equal(loaded.transactions.length, 2);
      assert.equal(loaded.transactions[0].category, "Mascotas");
      assert.equal(loaded.transactions[0].classificationSource, "manual");
      assert.equal(loaded.transactions[0].isSubscription, true);
    });
  });

  describe("Panel 2: Vendor Concentration Hidden Preferences & Config Persistence", () => {
    it("persists and restores separate hidden vendor lists for amount and frequency", () => {
      // Initially empty
      assert.deepStrictEqual(loadStoredHiddenVendors("amount"), []);
      assert.deepStrictEqual(loadStoredHiddenVendors("frequency"), []);

      // Save hidden vendors for amount
      saveStoredHiddenVendors("amount", ["Supermercado La Torre", "Paiz"]);
      assert.deepStrictEqual(loadStoredHiddenVendors("amount"), [
        "Supermercado La Torre",
        "Paiz",
      ]);
      // Frequency remains empty
      assert.deepStrictEqual(loadStoredHiddenVendors("frequency"), []);

      // Save hidden vendors for frequency
      saveStoredHiddenVendors("frequency", ["Uber", "Shell"]);
      assert.deepStrictEqual(loadStoredHiddenVendors("frequency"), ["Uber", "Shell"]);
      // Amount remains intact
      assert.deepStrictEqual(loadStoredHiddenVendors("amount"), [
        "Supermercado La Torre",
        "Paiz",
      ]);
    });

    it("persists and restores hideFromBothPanels configuration with default false", () => {
      // Default false when not set
      assert.strictEqual(loadStoredHideBothPanelsConfig(), false);

      // Save true
      saveStoredHideBothPanelsConfig(true);
      assert.strictEqual(loadStoredHideBothPanelsConfig(), true);

      // Save false
      saveStoredHideBothPanelsConfig(false);
      assert.strictEqual(loadStoredHideBothPanelsConfig(), false);
    });
  });

  describe("Dashboard: Resizable Panels Dimensions Persistence", () => {
    it("returns default dimensions when no stored configuration exists", () => {
      const dimensions = loadStoredPanelDimensions();
      assert.strictEqual(dimensions.leftWidthPercent, DEFAULT_PANEL_DIMENSIONS.leftWidthPercent);
      assert.deepStrictEqual(dimensions.heights, DEFAULT_PANEL_DIMENSIONS.heights);
    });

    it("persists and restores custom width split and panel heights", () => {
      const customDimensions = {
        leftWidthPercent: 62,
        heights: {
          "panel-category-trends": 520,
          "panel-consumption-patterns": 380,
          "panel-vendor-concentration": 490,
          "panel-transaction-age": 410,
        },
      };

      const saved = saveStoredPanelDimensions(customDimensions);
      assert.strictEqual(saved, true);

      const restored = loadStoredPanelDimensions();
      assert.strictEqual(restored.leftWidthPercent, 62);
      assert.strictEqual(restored.heights["panel-category-trends"], 520);
      assert.strictEqual(restored.heights["panel-consumption-patterns"], 380);
      assert.strictEqual(restored.heights["panel-vendor-concentration"], 490);
      assert.strictEqual(restored.heights["panel-transaction-age"], 410);
    });

    it("gracefully clamps out-of-range width and height values", () => {
      // Width below minimum (20) or above maximum (80)
      mockStore.setItem(
        STORAGE_KEY_PANEL_DIMENSIONS,
        JSON.stringify({
          leftWidthPercent: 99,
          heights: {
            "panel-category-trends": 50, // below minimum 220
          },
        })
      );

      const restored = loadStoredPanelDimensions();
      // Out of bounds width falls back to default 50
      assert.strictEqual(restored.leftWidthPercent, DEFAULT_PANEL_DIMENSIONS.leftWidthPercent);
      // Out of bounds height falls back to default 440
      assert.strictEqual(
        restored.heights["panel-category-trends"],
        DEFAULT_PANEL_DIMENSIONS.heights["panel-category-trends"]
      );
    });

    it("resets stored panel dimensions to default", () => {
      saveStoredPanelDimensions({
        leftWidthPercent: 35,
        heights: {
          "panel-category-trends": 600,
          "panel-consumption-patterns": 400,
          "panel-vendor-concentration": 500,
          "panel-transaction-age": 400,
        },
      });

      assert.ok(mockStore.getItem(STORAGE_KEY_PANEL_DIMENSIONS));

      const reset = resetStoredPanelDimensions();
      assert.strictEqual(reset, true);
      assert.strictEqual(mockStore.getItem(STORAGE_KEY_PANEL_DIMENSIONS), null);

      const restored = loadStoredPanelDimensions();
      assert.strictEqual(restored.leftWidthPercent, DEFAULT_PANEL_DIMENSIONS.leftWidthPercent);
    });
  });

  describe("US-054: Budget Data Structures & LocalStorage Persistence Unit Tests", () => {
    const mockPlan2026_08: BudgetPlan = {
      id: "plan-august",
      name: "Presupuesto Agosto",
      totalMonthlyBudgetGTQ: 4500,
      createdMode: "zero",
      updatedAt: "2026-08-01T10:00:00.000Z",
      targets: [
        {
          categoryId: "supermercado",
          categoryName: "Supermercado",
          monthlyLimitGTQ: 2000,
          isEssential: true,
        },
        {
          categoryId: "restaurantes",
          categoryName: "Restaurantes y Cafés",
          monthlyLimitGTQ: 500,
          isEssential: false,
        },
      ],
    };

    const mockPlanCurrent: BudgetPlan = {
      id: "plan-current",
      name: "Presupuesto Actual",
      totalMonthlyBudgetGTQ: 5000,
      createdMode: "transactions",
      updatedAt: "2026-09-01T10:00:00.000Z",
      targets: [
        {
          categoryId: "supermercado",
          categoryName: "Supermercado",
          monthlyLimitGTQ: 2200,
          isEssential: true,
        },
        {
          categoryId: "servicios",
          categoryName: "Servicios Básicos",
          monthlyLimitGTQ: 800,
          isEssential: true,
        },
      ],
    };

    it("saves and loads a valid StoredBudgetState correctly", () => {
      const budgetState: StoredBudgetState = {
        currentBudget: mockPlanCurrent,
        monthlyBudgets: {
          "2026-08": mockPlan2026_08,
        },
        effectiveFromMonth: "2026-09",
      };

      const saved = saveStoredBudgetState(budgetState);
      assert.strictEqual(saved, true);

      const loaded = loadStoredBudgetState();
      assert.ok(loaded);
      assert.strictEqual(loaded.effectiveFromMonth, "2026-09");
      assert.strictEqual(loaded.currentBudget?.id, "plan-current");
      assert.strictEqual(loaded.currentBudget?.totalMonthlyBudgetGTQ, 5000);
      assert.strictEqual(loaded.monthlyBudgets["2026-08"].id, "plan-august");
      assert.strictEqual(loaded.monthlyBudgets["2026-08"].targets.length, 2);
    });

    it("handles corruption resilience and self-heals by wiping invalid budget state", () => {
      mockStore.setItem(STORAGE_KEY_BUDGET, "invalid-json-string{");
      const loadedMalformed = loadStoredBudgetState();
      assert.strictEqual(loadedMalformed, null);
      assert.strictEqual(mockStore.getItem(STORAGE_KEY_BUDGET), null);

      mockStore.setItem(STORAGE_KEY_BUDGET, JSON.stringify({ currentBudget: "not-an-object" }));
      const loadedInvalidStructure = loadStoredBudgetState();
      assert.strictEqual(loadedInvalidStructure, null);
      assert.strictEqual(mockStore.getItem(STORAGE_KEY_BUDGET), null);
    });

    it("clears stored budget state with clearStoredBudgetState", () => {
      saveStoredBudgetState({
        currentBudget: mockPlanCurrent,
        monthlyBudgets: {},
        effectiveFromMonth: null,
      });
      assert.ok(mockStore.getItem(STORAGE_KEY_BUDGET));

      const cleared = clearStoredBudgetState();
      assert.strictEqual(cleared, true);
      assert.strictEqual(mockStore.getItem(STORAGE_KEY_BUDGET), null);
    });

    it("resolves exact month-specific budget with getBudgetForMonth", () => {
      const stateWithHistorical: StoredBudgetState = {
        currentBudget: mockPlanCurrent,
        monthlyBudgets: {
          "2026-07": mockPlan2026_08,
          "2026-08": mockPlan2026_08,
        },
        effectiveFromMonth: "2026-09",
      };

      // 1. Month present in monthlyBudgets returns historical snapshot
      const augBudget = getBudgetForMonth(stateWithHistorical, "2026-08");
      assert.strictEqual(augBudget?.id, "plan-august");
      assert.strictEqual(augBudget?.totalMonthlyBudgetGTQ, 4500);

      // 2. Month equal to or after effectiveFromMonth returns currentBudget
      const sepBudget = getBudgetForMonth(stateWithHistorical, "2026-09");
      assert.strictEqual(sepBudget?.id, "plan-current");

      const octBudget = getBudgetForMonth(stateWithHistorical, "2026-10");
      assert.strictEqual(octBudget?.id, "plan-current");

      // 3. Past month without snapshot before effectiveFromMonth returns null
      const juneBudget = getBudgetForMonth(stateWithHistorical, "2026-06");
      assert.strictEqual(juneBudget, null);

      // 4. If no effectiveFromMonth is set, currentBudget applies generally
      const stateNoEffective: StoredBudgetState = {
        currentBudget: mockPlanCurrent,
        monthlyBudgets: {},
        effectiveFromMonth: null,
      };
      const anyMonthBudget = getBudgetForMonth(stateNoEffective, "2026-05");
      assert.strictEqual(anyMonthBudget?.id, "plan-current");
    });
  });
});

