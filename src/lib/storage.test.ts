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
  STORAGE_KEY_SESSION,
  STORAGE_KEY_CATEGORIES,
} from "./storage";
import { Transaction, CSVParsingSummary, CustomCategory } from "@/types/transaction";

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
});
