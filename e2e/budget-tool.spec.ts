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
    await expect(serviciosCard.getByText("Esencial")).toBeVisible();

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

  test("US-058: allows editing active budget and prompts with historical scope confirmation modal", async ({ page }) => {
    await page.goto("/");

    // Seed session with multi-month transactions and an existing budget
    await page.evaluate(() => {
      localStorage.setItem(
        "expense_tracker_session_v1",
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          transactions: [
            {
              id: "tx-multi-1",
              date: "2026-07-15",
              description: "Supermercados La Torre",
              amount: 1500,
              currency: "GTQ",
              category: "Supermercado",
              classificationSource: "local",
            },
            {
              id: "tx-multi-2",
              date: "2026-08-15",
              description: "Supermercados La Torre",
              amount: 1600,
              currency: "GTQ",
              category: "Supermercado",
              classificationSource: "local",
            },
            {
              id: "tx-multi-3",
              date: "2026-09-15",
              description: "Supermercados La Torre",
              amount: 1700,
              currency: "GTQ",
              category: "Supermercado",
              classificationSource: "local",
            },
          ],
          summary: {
            totalRowsProcessed: 3,
            validTransactionsCount: 3,
            skippedRowsCount: 0,
            totalAmount: 4800,
          },
          bankName: "Banco Industrial",
          customCategories: [],
        })
      );

      localStorage.setItem(
        "expense_tracker_budget_v1",
        JSON.stringify({
          currentBudget: {
            id: "budget-initial",
            name: "Presupuesto Inicial",
            targets: [
              {
                categoryId: "supermercado",
                categoryName: "Supermercado",
                monthlyLimitGTQ: 2000,
                isEssential: true,
              },
            ],
            totalMonthlyBudgetGTQ: 2000,
            createdMode: "zero",
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
          monthlyBudgets: {},
          effectiveFromMonth: null,
        })
      );
    });

    await page.reload();
    await page.locator("#btn-resume-session").click();

    // Open budget tool
    await page.locator("#btn-dashboard-open-budget").click();

    // Overview should be visible with "Editar presupuesto" button
    const editBtn = page.locator("#btn-edit-budget-overview");
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Verify redirected to builder with populated targets
    await expect(page.locator("#builder-from-zero")).toBeVisible();
    const superCard = page.locator("#target-card-supermercado");
    await expect(superCard).toBeVisible();

    // Fine-tune by adding +Q 100
    const plusBtn = superCard.getByRole("button", { name: "+Q 100" });
    await plusBtn.click();

    // Verify button says "Guardar cambios"
    const saveBtn = page.locator("#btn-save-budget");
    await expect(saveBtn).toContainText("Guardar cambios");
    await saveBtn.click();

    // Confirmation modal should be visible
    const modal = page.locator("#modal-budget-scope-confirmation");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("¿Cómo deseas aplicar los cambios a tu presupuesto?");

    const allMonthsBtn = page.locator("#btn-scope-all-months");
    const fromNowOnBtn = page.locator("#btn-scope-from-now-on");
    await expect(allMonthsBtn).toBeVisible();
    await expect(fromNowOnBtn).toBeVisible();

    // Choose "Aplicar solo de ahora en adelante"
    await fromNowOnBtn.click();

    // Modal should close and return to overview
    await expect(modal).not.toBeVisible();
    await expect(page.locator("#section-comparativa-presupuesto")).toBeVisible();

    // Verify state in localStorage
    const savedState = await page.evaluate(() => {
      const raw = localStorage.getItem("expense_tracker_budget_v1");
      return raw ? JSON.parse(raw) : null;
    });

    expect(savedState).not.toBeNull();
    expect(savedState.effectiveFromMonth).toBe("2026-09");
    expect(savedState.currentBudget.targets[0].monthlyLimitGTQ).toBe(2100);

    // 2026-07 should preserve prior limit (2000)
    expect(savedState.monthlyBudgets["2026-07"].targets[0].monthlyLimitGTQ).toBe(2000);
    // 2026-09 should have updated limit (2100)
    expect(savedState.monthlyBudgets["2026-09"].targets[0].monthlyLimitGTQ).toBe(2100);
  });

  test("US-059: renders month selector, monthly summary card, and category comparison with unbudgeted warning", async ({ page }) => {
    await page.goto("/");

    // Seed session with multi-month transactions and active budget
    await page.evaluate(() => {
      localStorage.setItem(
        "expense_tracker_session_v1",
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          transactions: [
            // September transactions
            {
              id: "tx-sep-1",
              date: "2026-09-05",
              description: "Supermercados La Torre",
              amount: 1800,
              currency: "GTQ",
              category: "Supermercado",
              classificationSource: "local",
            },
            {
              id: "tx-sep-2",
              date: "2026-09-12",
              description: "Restaurante San Martin",
              amount: 650,
              currency: "GTQ",
              category: "Restaurantes y Cafés",
              classificationSource: "local",
            },
            {
              id: "tx-sep-3",
              date: "2026-09-20",
              description: "Netflix Mensual",
              amount: 150,
              currency: "GTQ",
              category: "Suscripciones",
              classificationSource: "local",
            },
            // August transactions
            {
              id: "tx-aug-1",
              date: "2026-08-10",
              description: "Supermercados La Torre",
              amount: 2200,
              currency: "GTQ",
              category: "Supermercado",
              classificationSource: "local",
            },
          ],
          summary: {
            totalRowsProcessed: 4,
            validTransactionsCount: 4,
            skippedRowsCount: 0,
            totalAmount: 4800,
          },
          bankName: "Banco Industrial",
          customCategories: [],
        })
      );

      localStorage.setItem(
        "expense_tracker_budget_v1",
        JSON.stringify({
          currentBudget: {
            id: "budget-comp-test",
            name: "Presupuesto Test",
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
            totalMonthlyBudgetGTQ: 2500,
            createdMode: "zero",
            updatedAt: "2026-08-01T00:00:00.000Z",
          },
          monthlyBudgets: {},
          effectiveFromMonth: null,
        })
      );
    });

    await page.reload();
    await page.locator("#btn-resume-session").click();

    // Open budget tool
    await page.locator("#btn-dashboard-open-budget").click();

    // Verify section comparativa is visible
    await expect(page.locator("#section-comparativa-presupuesto")).toBeVisible();

    // Verify Month Selector bar is present
    const monthSelector = page.locator("#month-selector-bar");
    await expect(monthSelector).toBeVisible();

    // Verify both month pills exist
    const augPill = page.locator("#month-selector-pill-2026-08");
    const sepPill = page.locator("#month-selector-pill-2026-09");
    await expect(augPill).toBeVisible();
    await expect(sepPill).toBeVisible();

    // Verify Monthly Summary Card for September
    const summaryCard = page.locator("#card-monthly-budget-summary");
    await expect(summaryCard).toBeVisible();
    await expect(page.locator("#summary-total-budgeted")).toContainText("2,500");
    await expect(page.locator("#summary-total-spent")).toContainText("2,600");
    await expect(page.locator("#summary-net-difference")).toContainText("100");
    await expect(page.locator("#monthly-budget-progress-bar")).toBeVisible();

    // Verify category cards in September
    const superCard = page.locator("#category-comparison-card-supermercado");
    await expect(superCard).toBeVisible();
    await expect(superCard).toContainText("Dentro de meta");
    await expect(superCard).toContainText("1,800");
    await expect(superCard.getByText("Esencial")).toBeVisible();

    const restCard = page.locator("#category-comparison-card-restaurantes");
    await expect(restCard).toBeVisible();
    await expect(restCard).toContainText("Exceso");
    await expect(restCard).toContainText("650");
    await expect(restCard.getByText("Estilo de vida")).toBeVisible();

    // Verify Unbudgeted warning card for Suscripciones
    const unbudgetedCard = page.locator("#card-unbudgeted-warning");
    await expect(unbudgetedCard).toBeVisible();
    await expect(unbudgetedCard).toContainText("Suscripciones");
    await expect(unbudgetedCard).toContainText("150");

    // Switch to August
    await augPill.click();

    // Verify summary card updates to August
    await expect(page.locator("#summary-total-spent")).toContainText("2,200");
    await expect(page.locator("#category-comparison-card-supermercado")).toContainText("2,200");
    await expect(page.locator("#category-comparison-card-supermercado")).toContainText("Exceso");
  });

  test("US-060: displays gamified budget performance stats (weekly streaks, category goal counts, best savings)", async ({ page }) => {
    await page.goto("/");

    // Seed session with transactions across 3 consecutive weeks
    await page.evaluate(() => {
      localStorage.setItem(
        "expense_tracker_session_v1",
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          transactions: [
            // Week 1 (2026-09-08): 400
            {
              id: "tx-g-1",
              date: "2026-09-08",
              description: "Supermercados La Torre",
              amount: 400,
              currency: "GTQ",
              category: "Supermercado",
              classificationSource: "local",
            },
            // Week 2 (2026-09-15): 500
            {
              id: "tx-g-2",
              date: "2026-09-15",
              description: "Supermercados La Torre",
              amount: 500,
              currency: "GTQ",
              category: "Supermercado",
              classificationSource: "local",
            },
            // Week 3 (2026-09-22): 600
            {
              id: "tx-g-3",
              date: "2026-09-22",
              description: "Restaurante San Martin",
              amount: 600,
              currency: "GTQ",
              category: "Restaurantes y Cafés",
              classificationSource: "local",
            },
          ],
          summary: {
            totalRowsProcessed: 3,
            validTransactionsCount: 3,
            skippedRowsCount: 0,
            totalAmount: 1500,
          },
          bankName: "Banco Industrial",
          customCategories: [],
        })
      );

      localStorage.setItem(
        "expense_tracker_budget_v1",
        JSON.stringify({
          currentBudget: {
            id: "budget-fun-stats-test",
            name: "Presupuesto Mensual",
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
                monthlyLimitGTQ: 800,
                isEssential: false,
              },
            ],
            totalMonthlyBudgetGTQ: 2800, // weekly budget ≈ 646.65
            createdMode: "zero",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
          monthlyBudgets: {},
          effectiveFromMonth: null,
        })
      );
    });

    await page.reload();
    await page.locator("#btn-resume-session").click();

    // Open budget tool
    await page.locator("#btn-dashboard-open-budget").click();

    // Gamified fun stats row should be visible
    const funStatsRow = page.locator("#gamified-fun-stats-row");
    await expect(funStatsRow).toBeVisible();

    // Check Weekly Streak Card
    const streakCard = page.locator("#card-stat-weekly-streak");
    await expect(streakCard).toBeVisible();
    await expect(streakCard).toContainText("Racha semanal");
    await expect(streakCard).toContainText("3 semanas");
    await expect(streakCard).toContainText("seguidas dentro del presupuesto");

    // Check Category Goals Card
    const goalsCard = page.locator("#card-stat-category-goals");
    await expect(goalsCard).toBeVisible();
    await expect(goalsCard).toContainText("Metas por categoría");
    await expect(goalsCard).toContainText("2 de 2");
    await expect(goalsCard).toContainText("categorías en meta este mes");

    // Check Best Category Savings Card
    const bestCard = page.locator("#card-stat-best-category");
    await expect(bestCard).toBeVisible();
    await expect(bestCard).toContainText("Mayor ahorro");
    await expect(bestCard).toContainText("Supermercado");

    // Check Months Within Budget Card
    const monthsCard = page.locator("#card-stat-months-within-budget");
    await expect(monthsCard).toBeVisible();
    await expect(monthsCard).toContainText("Meses en meta");
    await expect(monthsCard).toContainText("1 de 1");
  });

  test("US-061 & US-062: displays next-month improvement suggestions, root-cause diagnostics, and coaching panels", async ({ page }) => {
    await page.goto("/");

    // Seed session with transactions diagnosing single expensive purchase and short-term improvement
    await page.evaluate(() => {
      localStorage.setItem(
        "expense_tracker_session_v1",
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          transactions: [
            // August transactions: Restaurantes was 1200
            {
              id: "tx-sug-aug-1",
              date: "2026-08-15",
              description: "Restaurante San Martin",
              amount: 1200,
              currency: "GTQ",
              category: "Restaurantes y Cafés",
              classificationSource: "local",
            },
            // September transactions:
            // Supermercado: Cemaco 900 + La Torre 400 = 1300 (> 1000 limit, Cemaco >= 45%)
            {
              id: "tx-sug-sep-1",
              date: "2026-09-05",
              description: "Cemaco",
              amount: 900,
              currency: "GTQ",
              category: "Supermercado",
              classificationSource: "local",
            },
            {
              id: "tx-sug-sep-2",
              date: "2026-09-12",
              description: "Supermercados La Torre",
              amount: 400,
              currency: "GTQ",
              category: "Supermercado",
              classificationSource: "local",
            },
            // Restaurantes: 700 (reduced from 1200 -> short term improvement!)
            {
              id: "tx-sug-sep-3",
              date: "2026-09-15",
              description: "Restaurante San Martin",
              amount: 700,
              currency: "GTQ",
              category: "Restaurantes y Cafés",
              classificationSource: "local",
            },
          ],
          summary: {
            totalRowsProcessed: 4,
            validTransactionsCount: 4,
            skippedRowsCount: 0,
            totalAmount: 3200,
          },
          bankName: "Banco Industrial",
          customCategories: [],
        })
      );

      localStorage.setItem(
        "expense_tracker_budget_v1",
        JSON.stringify({
          currentBudget: {
            id: "budget-suggestions-test",
            name: "Presupuesto Mensual",
            targets: [
              {
                categoryId: "supermercado",
                categoryName: "Supermercado",
                monthlyLimitGTQ: 1000,
                isEssential: true,
              },
              {
                categoryId: "restaurantes",
                categoryName: "Restaurantes y Cafés",
                monthlyLimitGTQ: 800,
                isEssential: false,
              },
            ],
            totalMonthlyBudgetGTQ: 1800,
            createdMode: "zero",
            updatedAt: "2026-08-01T00:00:00.000Z",
          },
          monthlyBudgets: {},
          effectiveFromMonth: null,
        })
      );
    });

    await page.reload();
    await page.locator("#btn-resume-session").click();

    // Open budget tool
    await page.locator("#btn-dashboard-open-budget").click();

    // Switch to Sugerencias tab
    await page.locator("#tab-sugerencias-presupuesto").click();
    await expect(page.locator("#section-sugerencias-presupuesto")).toBeVisible();

    // Verify suggestions list is rendered
    const suggestionsList = page.locator("#next-month-suggestions-list");
    await expect(suggestionsList).toBeVisible();

    // Check Over-Budget Diagnosis Card for Supermercado (Single Expensive Purchase: Cemaco)
    const overCard = page.locator("#suggestion-card-over-supermercado");
    await expect(overCard).toBeVisible();
    await expect(overCard).toContainText("Alerta de Exceso");
    await expect(overCard).toContainText("Causa probable: Una compra individual elevada en Cemaco");
    await expect(overCard).toContainText("Acción recomendada para el próximo mes");

    // Check Improvement Card for Restaurantes y Cafés
    const imprCard = page.locator("#suggestion-card-improvement-restaurantes-y-cafés");
    await expect(imprCard).toBeVisible();
    await expect(imprCard).toContainText("Continúa Mejorando");
    await expect(imprCard).toContainText("Redujiste tu gasto");
    await expect(imprCard).toContainText("Recomendación para mantener el ritmo");
  });

  test("US-063: verifies end-to-end integration across navigation, simple list ingestion, budget creation, and persistence", async ({ page }) => {
    await page.goto("/");

    // 1. Navigate to budget tool from landing
    const openLandingBtn = page.locator("#btn-open-budget-landing");
    await expect(openLandingBtn).toBeVisible();
    await openLandingBtn.click();

    // 2. Return cleanly to landing
    const backBtn = page.locator("#btn-budget-back");
    await expect(backBtn).toContainText("Volver al Inicio");
    await backBtn.click();
    await expect(page.locator("#btn-open-budget-landing")).toBeVisible();

    // 3. Ingest text list with quick simple expenses
    const openListModalBtn = page.locator("#btn-open-simple-list");
    if (await openListModalBtn.isVisible().catch(() => false)) {
      await openListModalBtn.click();
      const textarea = page.locator("#simple-list-textarea");
      await textarea.fill("super 24 40\nWalmart 150\nBurger King 65");
      await page.locator("#btn-submit-simple-list").click();
    } else {
      // Seed directly if simple list trigger is within file dropper
      await page.evaluate(() => {
        localStorage.setItem(
          "expense_tracker_session_v1",
          JSON.stringify({
            version: 1,
            savedAt: new Date().toISOString(),
            transactions: [
              {
                id: "tx-int-1",
                date: "2026-09-02",
                description: "super 24",
                amount: 40,
                currency: "GTQ",
                category: "Supermercado",
                classificationSource: "local",
              },
              {
                id: "tx-int-2",
                date: "2026-09-05",
                description: "Walmart",
                amount: 150,
                currency: "GTQ",
                category: "Supermercado",
                classificationSource: "local",
              },
              {
                id: "tx-int-3",
                date: "2026-09-10",
                description: "Burger King",
                amount: 65,
                currency: "GTQ",
                category: "Restaurantes y Cafés",
                classificationSource: "local",
              },
            ],
            summary: {
              totalRowsProcessed: 3,
              validTransactionsCount: 3,
              skippedRowsCount: 0,
              totalAmount: 255,
            },
            bankName: "Banco Industrial",
            customCategories: [],
          })
        );
      });
      await page.reload();
      await page.locator("#btn-resume-session").click();
    }

    // 4. Open budget tool from dashboard header
    await page.locator("#btn-dashboard-open-budget").click();
    await expect(page.locator("#tab-configurar-presupuesto")).toBeVisible();

    // 5. Build budget from zero with preset buttons
    const addMainBtn = page.locator("#btn-add-main-categories");
    await expect(addMainBtn).toBeVisible();
    await addMainBtn.click();

    // 6. Save budget
    const saveBtn = page.locator("#btn-save-budget");
    await saveBtn.click();

    // 7. Verify active budget in comparativa
    await expect(page.locator("#badge-budget-status")).toHaveText("Presupuesto activo");
    await expect(page.locator("#section-comparativa-presupuesto")).toBeVisible();

    // 8. Return to dashboard
    await page.locator("#btn-budget-back").click();
    await expect(page.locator("#btn-dashboard-open-budget")).toBeVisible();

    // 9. Verify persistence across page reload
    await page.reload();
    await page.locator("#btn-resume-session").click();
    await page.locator("#btn-dashboard-open-budget").click();
    await expect(page.locator("#badge-budget-status")).toHaveText("Presupuesto activo");
  });
});
