import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  saveStoredSession,
  loadStoredSession,
  clearStoredSession,
  saveStoredCategories,
  loadStoredCategories,
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
});
