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

  test("US-056: creates budget from zero using tiered category presets and quick actions", async ({ page }) => {
    await page.goto("/");

    // Open budget tool from landing
    await page.locator("#btn-open-budget-landing").click();
    await expect(page.locator("#tab-configurar-presupuesto")).toBeVisible();

    // Verify option 2 is disabled without transactions
    const fromTxsOption = page.locator("#btn-mode-from-transactions");
    await expect(fromTxsOption).toBeDisabled();

    // Verify option 1 (desde cero) is selected
    const fromZeroOption = page.locator("#btn-mode-from-zero");
    await expect(fromZeroOption).toBeVisible();

    // Click "Agregar categorías principales"
    const addMainBtn = page.locator("#btn-add-main-categories");
    await expect(addMainBtn).toBeVisible();
    await addMainBtn.click();

    // Verify essential and discretionary cards were added
    const supermercadoCard = page.locator("#target-card-supermercado");
    await expect(supermercadoCard).toBeVisible();
    await expect(supermercadoCard.getByText("Esencial")).toBeVisible();

    const restaurantesCard = page.locator("#target-card-restaurantes");
    await expect(restaurantesCard).toBeVisible();
    await expect(restaurantesCard.getByText("Estilo de vida")).toBeVisible();

    // Verify essential tiered amount preset chips (e.g., Q 3,000)
    const preset3000 = supermercadoCard.getByRole("button", { name: "Q 3,000" });
    await expect(preset3000).toBeVisible();
    await preset3000.click();

    // Fine-tune with +Q 100
    const plusBtn = supermercadoCard.getByRole("button", { name: "+Q 100" });
    await plusBtn.click();

    // Verify summary bar is updated
    const summaryBar = page.locator("#budget-builder-summary-bar");
    await expect(summaryBar).toBeVisible();
    await expect(page.locator("#total-budgeted-display")).toBeVisible();

    // Click "Guardar presupuesto"
    const saveBtn = page.locator("#btn-save-budget");
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Verify transition to comparativa tab and active status badge
    await expect(page.locator("#badge-budget-status")).toHaveText("Presupuesto activo");
    await expect(page.locator("#section-comparativa-presupuesto")).toBeVisible();

    // Verify persistence after page reload
    await page.reload();
    await page.locator("#btn-open-budget-landing").click();
    await expect(page.locator("#badge-budget-status")).toHaveText("Presupuesto activo");
  });

  test("US-056: displays historical context chips when transactions exist", async ({ page }) => {
    await page.goto("/");

    // Seed session with transactions
    await page.evaluate(() => {
      localStorage.setItem(
        "expense_tracker_session_v1",
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          transactions: [
            {
              id: "tx-h-1",
              date: "2026-08-01",
              description: "Supermercados La Torre",
              amount: 1000,
              currency: "GTQ",
              category: "Supermercado",
              classificationSource: "local",
            },
            {
              id: "tx-h-2",
              date: "2026-09-01",
              description: "Supermercados La Torre",
              amount: 1500,
              currency: "GTQ",
              category: "Supermercado",
              classificationSource: "local",
            },
          ],
          summary: {
            totalRowsProcessed: 2,
            validTransactionsCount: 2,
            skippedRowsCount: 0,
            totalAmount: 2500,
          },
          bankName: "Banco Industrial",
          customCategories: [],
        })
      );
    });

    await page.reload();
    await page.locator("#btn-resume-session").click();

    // Open budget tool from dashboard
    await page.locator("#btn-dashboard-open-budget").click();

    // Switch to configurar tab
    await page.locator("#tab-configurar-presupuesto").click();

    // Click Supermercado chip to add it
    const superChip = page.locator("#chip-cat-supermercado");
    if (!(await page.locator("#target-card-supermercado").isVisible().catch(() => false))) {
      await superChip.click();
    }

    // Historical chips should be rendered
    const historyAvgChip = page.locator("#chip-history-avg-supermercado");
    await expect(historyAvgChip).toBeVisible();
    await expect(historyAvgChip).toContainText("Promedio: Q");

    // Click historical chip to set target
    await historyAvgChip.click();

    // Click save
    await page.locator("#btn-save-budget").click();
    await expect(page.locator("#badge-budget-status")).toHaveText("Presupuesto activo");
  });

  test("US-057: generates realistic budget from uploaded transactions with achievable targets", async ({ page }) => {
    await page.goto("/");

    // Seed session with realistic multi-category transactions
    await page.evaluate(() => {
      localStorage.setItem(
        "expense_tracker_session_v1",
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          transactions: [
            {
              id: "tx-r-1",
              date: "2026-09-02",
              description: "Supermercados La Torre",
              amount: 2000,
              currency: "GTQ",
              category: "Supermercado",
              classificationSource: "local",
            },
            {
              id: "tx-r-2",
              date: "2026-09-05",
              description: "Restaurante San Martin",
              amount: 600,
              currency: "GTQ",
              category: "Restaurantes y Cafés",
              classificationSource: "local",
            },
            {
              id: "tx-r-3",
              date: "2026-09-10",
              description: "Pago EEGSA",
              amount: 400,
              currency: "GTQ",
              category: "Servicios Básicos",
              classificationSource: "local",
            },
            {
              id: "tx-r-4",
              date: "2026-09-15",
              description: "Gasolinera Shell",
              amount: 800,
              currency: "GTQ",
              category: "Transporte y Combustible",
              classificationSource: "local",
            },
          ],
          summary: {
            totalRowsProcessed: 4,
            validTransactionsCount: 4,
            skippedRowsCount: 0,
            totalAmount: 3800,
          },
          bankName: "Banco Industrial",
          customCategories: [],
        })
      );
    });

    await page.reload();
    await page.locator("#btn-resume-session").click();

    // Open budget tool
    await page.locator("#btn-dashboard-open-budget").click();
    await page.locator("#tab-configurar-presupuesto").click();

    // Select mode: Generar basado en mis gastos subidos
    const fromTxsBtn = page.locator("#btn-mode-from-transactions");
    await expect(fromTxsBtn).toBeEnabled();
    await fromTxsBtn.click();

    // Verify realistic review screen is rendered
    const realisticSection = page.locator("#builder-from-transactions");
    await expect(realisticSection).toBeVisible();

    // Verify generated category cards exist
    const superCard = page.locator("#realistic-target-card-supermercado");
    await expect(superCard).toBeVisible();
    await expect(superCard).toContainText("Gasto promedio actual");

    const serviciosCard = page.locator("#realistic-target-card-servicios");
    await expect(serviciosCard).toBeVisible();
    await expect(serviciosCard.getByText("Fijo / Esencial")).toBeVisible();

    // Test adjustment chip (-10%) on Supermercado
    const cut10Chip = superCard.locator("#chip-cut-10-supermercado");
    await expect(cut10Chip).toBeVisible();
    await cut10Chip.click();

    // Test adjustment chip (Igualar a mi promedio) on Servicios
    const matchAvgChip = serviciosCard.locator("#chip-match-avg-servicios");
    await expect(matchAvgChip).toBeVisible();
    await matchAvgChip.click();

    // Verify live summary bar
    const summaryBar = page.locator("#budget-realistic-summary-bar");
    await expect(summaryBar).toBeVisible();

    // Click confirm and save
    const confirmBtn = page.locator("#btn-confirm-save-budget-from-txs");
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Verify transition to comparativa and active status badge
    await expect(page.locator("#badge-budget-status")).toHaveText("Presupuesto activo");
    await expect(page.locator("#section-comparativa-presupuesto")).toBeVisible();

    // Verify localStorage has createdMode: "transactions"
    const savedBudget = await page.evaluate(() => {
      const raw = localStorage.getItem("expense_tracker_budget_v1");
      return raw ? JSON.parse(raw) : null;
    });

    expect(savedBudget).not.toBeNull();
    expect(savedBudget.currentBudget.createdMode).toBe("transactions");
    expect(savedBudget.currentBudget.targets.length).toBeGreaterThanOrEqual(4);
  });
});
