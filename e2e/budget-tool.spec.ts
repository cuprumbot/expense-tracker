import { test, expect } from "@playwright/test";

test.describe("US-054: Budget Data Structures & LocalStorage Persistence E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test("persists budget state in window.localStorage across reloads", async ({ page }) => {
    await page.goto("/");

    // Verify localStorage can store and retrieve budget state
    await page.evaluate(() => {
      const budgetState = {
        currentBudget: {
          id: "budget-test-1",
          name: "Presupuesto Test",
          targets: [
            {
              categoryId: "supermercado",
              categoryName: "Supermercado",
              monthlyLimitGTQ: 2500,
              isEssential: true,
            },
            {
              categoryId: "servicios",
              categoryName: "Servicios Básicos",
              monthlyLimitGTQ: 900,
              isEssential: true,
            },
          ],
          totalMonthlyBudgetGTQ: 3400,
          createdMode: "zero",
          updatedAt: new Date().toISOString(),
        },
        monthlyBudgets: {},
        effectiveFromMonth: null,
      };
      localStorage.setItem("expense_tracker_budget_v1", JSON.stringify(budgetState));
    });

    await page.reload();

    const storedBudget = await page.evaluate(() => {
      const raw = localStorage.getItem("expense_tracker_budget_v1");
      return raw ? JSON.parse(raw) : null;
    });

    expect(storedBudget).not.toBeNull();
    expect(storedBudget.currentBudget.id).toBe("budget-test-1");
    expect(storedBudget.currentBudget.totalMonthlyBudgetGTQ).toBe(3400);
    expect(storedBudget.currentBudget.targets).toHaveLength(2);
  });

  test("recovers from corrupted budget storage", async ({ page }) => {
    await page.goto("/");

    // Inject corrupted data
    await page.evaluate(() => {
      localStorage.setItem("expense_tracker_budget_v1", "{invalid json");
    });

    await page.reload();

    // Verify app handles it gracefully
    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("Organiza tus gastos mensuales");
  });

  test("US-055: opens budget tool from landing screen and returns seamlessly", async ({ page }) => {
    await page.goto("/");

    // 1. Verify prominent entry card is visible on landing
    const entryCard = page.locator("#card-budget-tool-entry");
    await expect(entryCard).toBeVisible();

    const openBtn = page.locator("#btn-open-budget-landing");
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    // 2. Verify Budget Tool View header, status badge and tabs
    await expect(page.getByRole("heading", { name: "Mi Presupuesto Mensual" })).toBeVisible();
    const statusBadge = page.locator("#badge-budget-status");
    await expect(statusBadge).toHaveText("Sin presupuesto configurado");

    await expect(page.locator("#tab-configurar-presupuesto")).toBeVisible();
    await expect(page.locator("#tab-comparativa-presupuesto")).toBeVisible();
    await expect(page.locator("#tab-sugerencias-presupuesto")).toBeVisible();

    // 3. Return to landing
    const backBtn = page.locator("#btn-budget-back");
    await expect(backBtn).toHaveText("Volver al Inicio");
    await backBtn.click();

    // Verify back on landing
    await expect(entryCard).toBeVisible();
  });

  test("US-055: opens budget tool from dashboard header and preserves active session", async ({ page }) => {
    // Seed active session
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "expense_tracker_session_v1",
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          transactions: [
            {
              id: "tx-demo-1",
              date: "2026-09-02",
              description: "Supermercados La Torre",
              amount: 450,
              currency: "GTQ",
              category: "Supermercado",
              classificationSource: "local",
            },
          ],
          summary: {
            totalRowsProcessed: 1,
            validTransactionsCount: 1,
            skippedRowsCount: 0,
            totalAmount: 450,
          },
          bankName: "Banco Industrial",
          customCategories: [],
        })
      );
    });

    await page.reload();

    // Click resume session to enter dashboard
    const resumeBtn = page.locator("#btn-resume-session");
    await expect(resumeBtn).toBeVisible();
    await resumeBtn.click();

    // Verify dashboard is active
    const budgetBtn = page.locator("#btn-dashboard-open-budget");
    await expect(budgetBtn).toBeVisible();
    await budgetBtn.click();

    // Verify Budget Tool View
    await expect(page.getByRole("heading", { name: "Mi Presupuesto Mensual" })).toBeVisible();
    const backBtn = page.locator("#btn-budget-back");
    await expect(backBtn).toHaveText("Volver al Panel");

    // Switch tabs within budget tool
    await page.locator("#tab-comparativa-presupuesto").click();
    await expect(page.locator("#section-comparativa-presupuesto")).toBeVisible();

    await page.locator("#tab-sugerencias-presupuesto").click();
    await expect(page.locator("#section-sugerencias-presupuesto")).toBeVisible();

    // Return to dashboard
    await backBtn.click();

    // Verify dashboard and session transactions are still preserved
    await expect(page.locator("#btn-dashboard-open-budget")).toBeVisible();
    await expect(page.getByText("1 movimientos analizados")).toBeVisible();
  });
});
