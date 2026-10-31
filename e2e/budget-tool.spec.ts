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
});
