import {
  Transaction,
  CSVParsingSummary,
  CustomCategory,
} from "@/types/transaction";
import { SavingsRecommendationResponse } from "@/lib/savings-advisor";

export interface StoredSession {
  version: 1;
  transactions: Transaction[];
  summary: CSVParsingSummary;
  customCategories: CustomCategory[];
  savingsRecommendations?: SavingsRecommendationResponse | null;
  sourceLabel?: string;
  bankName?: string | null;
  savedAt: string;
}

export const STORAGE_KEY_SESSION = "expense_tracker_session_v1";
export const STORAGE_KEY_CATEGORIES = "expense_tracker_categories_v1";

/**
 * Checks if localStorage is available and writable in the current runtime environment.
 */
export function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const testKey = "__expense_tracker_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves the active session to localStorage with quota-exceeded and error handling.
 */
export function saveStoredSession(
  session: Omit<StoredSession, "version" | "savedAt">
): boolean {
  if (!isStorageAvailable()) return false;
  try {
    const payload: StoredSession = {
      ...session,
      version: 1,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn(
      "No se pudo guardar la sesión en localStorage (posible límite de cuota):",
      error
    );
    return false;
  }
}

/**
 * Loads the stored session from localStorage with validation against corrupt data.
 * If data is corrupted or malformed, it gracefully cleans the key and returns null.
 */
export function loadStoredSession(): StoredSession | null {
  if (!isStorageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_SESSION);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    // Structural integrity checks
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.transactions) ||
      !parsed.summary ||
      typeof parsed.summary !== "object"
    ) {
      clearStoredSession();
      return null;
    }

    return parsed as StoredSession;
  } catch (error) {
    console.warn("Datos corruptos detectados en localStorage, limpiando sesión:", error);
    clearStoredSession();
    return null;
  }
}

/**
 * Saves custom categories independently so they can persist across statement loads.
 */
export function saveStoredCategories(categories: CustomCategory[]): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(
      STORAGE_KEY_CATEGORIES,
      JSON.stringify(categories)
    );
    return true;
  } catch (error) {
    console.warn("Error al guardar categorías personalizadas en localStorage:", error);
    return false;
  }
}

/**
 * Loads custom categories from localStorage with corruption resilience.
 */
export function loadStoredCategories(): CustomCategory[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_CATEGORIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY_CATEGORIES);
      return [];
    }
    return parsed as CustomCategory[];
  } catch {
    window.localStorage.removeItem(STORAGE_KEY_CATEGORIES);
    return [];
  }
}

/**
 * Clears data stored in localStorage under the application namespace.
 * @param wipeCategories - If true, wipes custom categories as well (complete factory reset).
 * Defaults to true for backward compatibility with US-011 (Borrar mis datos).
 * When false, preserves custom categories in localStorage while clearing the active session (US-027).
 */
export function clearStoredSession(wipeCategories: boolean = true): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.removeItem(STORAGE_KEY_SESSION);
    if (wipeCategories) {
      window.localStorage.removeItem(STORAGE_KEY_CATEGORIES);
    }
    return true;
  } catch (error) {
    console.warn("Error al limpiar datos en localStorage:", error);
    return false;
  }
}

/**
 * Convenience helper to clear only transaction session data while strictly preserving custom categories.
 */
export function clearStoredSessionOnly(): boolean {
  return clearStoredSession(false);
}

export const STORAGE_KEY_VENDOR_HIDDEN_AMOUNT = "expense_tracker_hidden_vendors_amount";
export const STORAGE_KEY_VENDOR_HIDDEN_FREQUENCY = "expense_tracker_hidden_vendors_frequency";
export const STORAGE_KEY_VENDOR_HIDE_BOTH_PANELS = "expense_tracker_vendor_hide_both_panels";

/**
 * Loads stored hidden vendors for either amount or frequency metric mode.
 */
export function loadStoredHiddenVendors(mode: "amount" | "frequency"): string[] {
  if (!isStorageAvailable()) return [];
  try {
    const key =
      mode === "amount"
        ? STORAGE_KEY_VENDOR_HIDDEN_AMOUNT
        : STORAGE_KEY_VENDOR_HIDDEN_FREQUENCY;
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed.filter((item) => typeof item === "string") as string[])
      : [];
  } catch {
    return [];
  }
}

/**
 * Saves stored hidden vendors for either amount or frequency metric mode.
 */
export function saveStoredHiddenVendors(
  mode: "amount" | "frequency",
  vendors: string[]
): boolean {
  if (!isStorageAvailable()) return false;
  try {
    const key =
      mode === "amount"
        ? STORAGE_KEY_VENDOR_HIDDEN_AMOUNT
        : STORAGE_KEY_VENDOR_HIDDEN_FREQUENCY;
    window.localStorage.setItem(key, JSON.stringify(vendors));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads the configuration flag for hiding vendors across both panels.
 * Defaults to false (inactive).
 */
export function loadStoredHideBothPanelsConfig(): boolean {
  if (!isStorageAvailable()) return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_VENDOR_HIDE_BOTH_PANELS);
    return raw === "true";
  } catch {
    return false;
  }
}

/**
 * Saves the configuration flag for hiding vendors across both panels.
 */
export function saveStoredHideBothPanelsConfig(enabled: boolean): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(
      STORAGE_KEY_VENDOR_HIDE_BOTH_PANELS,
      String(enabled)
    );
    return true;
  } catch {
    return false;
  }
}
