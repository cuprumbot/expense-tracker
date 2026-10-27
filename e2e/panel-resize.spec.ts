import { test, expect } from "@playwright/test";

test.describe("Dashboard Resizable Panels & Persistence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Seed localStorage with mock session
    await page.evaluate(() => {
      localStorage.clear();
      const mockTransactions = [
        {
          id: "tx-1",
          date: "2026-06-15",
          description: "Supermercado Paiz",
          amount: 500,
          currency: "GTQ",
          category: "Supermercado",
        },
        {
          id: "tx-2",
          date: "2026-07-20",
          description: "Gasolinera Puma",
          amount: 250,
          currency: "GTQ",
          category: "Transporte",
        },
        {
          id: "tx-3",
          date: "2026-08-05",
          description: "Restaurante San Martin",
          amount: 180,
          currency: "GTQ",
          category: "Restaurantes",
        },
      ];
      localStorage.setItem(
        "expense_tracker_session_v1",
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          transactions: mockTransactions,
          summary: {
            totalRowsProcessed: 3,
            validTransactionsCount: 3,
            skippedRowsCount: 0,
            totalAmount: 930,
          },
          bankName: "Banco Industrial",
          customCategories: [],
        })
      );
    });
    await page.reload();
    const resumeBtn = page.getByRole("button", { name: "Continuar sesión" });
    await expect(resumeBtn).toBeVisible({ timeout: 10000 });
    await resumeBtn.click();
    await expect(page.locator("#dashboard-root")).toBeVisible({ timeout: 15000 });
  });

  test("renders resize indicators on all 4 panels", async ({ page }) => {
    const handle1 = page.locator("#resize-handle-panel-category-trends");
    const handle2 = page.locator("#resize-handle-panel-vendor-concentration");
    const handle3 = page.locator("#resize-handle-panel-consumption-patterns");
    const handle4 = page.locator("#resize-handle-panel-transaction-age");

    await expect(handle1).toBeVisible();
    await expect(handle2).toBeVisible();
    await expect(handle3).toBeVisible();
    await expect(handle4).toBeVisible();

    await expect(handle1).toHaveAttribute("role", "separator");
    await expect(handle1).toHaveAttribute("title", /redimensionar/i);
  });

  test("resizes panel vertically and pushes down the panel below it", async ({ page }) => {
    const panel1 = page.locator("#panel-category-trends");
    const panel3 = page.locator("#panel-consumption-patterns");

    const initialBox1 = await panel1.boundingBox();
    const initialBox3 = await panel3.boundingBox();
    expect(initialBox1).not.toBeNull();
    expect(initialBox3).not.toBeNull();

    // Verify Panel 3 is positioned below Panel 1
    expect(initialBox3!.y).toBeGreaterThan(initialBox1!.y + initialBox1!.height - 10);

    // Drag resize handle of Panel 1 down by 120px
    const handle1 = page.locator("#resize-handle-panel-category-trends");
    const handleBox = await handle1.boundingBox();
    expect(handleBox).not.toBeNull();

    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2 + 120, { steps: 5 });
    await page.mouse.up();

    // Verify Panel 1 grew in height
    const newBox1 = await panel1.boundingBox();
    const newBox3 = await panel3.boundingBox();
    expect(newBox1!.height).toBeGreaterThan(initialBox1!.height + 50);

    // Verify Panel 3 was pushed down
    expect(newBox3!.y).toBeGreaterThan(initialBox3!.y + 50);
  });

  test("resizes horizontally and resizes adjacent column inversely without overflow", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Chromium desktop check");

    // Ensure desktop viewport
    await page.setViewportSize({ width: 1280, height: 900 });

    const panel1 = page.locator("#panel-category-trends");
    const panel2 = page.locator("#panel-vendor-concentration");
    const panel3 = page.locator("#panel-consumption-patterns");

    const initialBox1 = await panel1.boundingBox();
    const initialBox2 = await panel2.boundingBox();
    const initialBox3 = await panel3.boundingBox();

    // Panel 1 and Panel 3 should have identical widths (both in left column)
    expect(Math.abs(initialBox1!.width - initialBox3!.width)).toBeLessThan(5);

    // Drag handle of Panel 1 to the right by 100px
    const handle1 = page.locator("#resize-handle-panel-category-trends");
    const handleBox = await handle1.boundingBox();

    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + handleBox!.width / 2 + 100, handleBox!.y + handleBox!.height / 2, { steps: 5 });
    await page.mouse.up();

    const newBox1 = await panel1.boundingBox();
    const newBox2 = await panel2.boundingBox();
    const newBox3 = await panel3.boundingBox();

    // Left column expanded
    expect(newBox1!.width).toBeGreaterThan(initialBox1!.width + 40);
    // Panel 3 below Panel 1 also expanded to match full left column width
    expect(Math.abs(newBox1!.width - newBox3!.width)).toBeLessThan(5);

    // Right column shrank inversely
    expect(newBox2!.width).toBeLessThan(initialBox2!.width - 40);

    // Verify no horizontal document overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test("persists dimensions to localStorage and restores them on page reload", async ({ page }) => {
    // Drag handle of Panel 1 down
    const handle1 = page.locator("#resize-handle-panel-category-trends");
    const handleBox = await handle1.boundingBox();

    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + handleBox!.width / 2 + 60, handleBox!.y + handleBox!.height / 2 + 80, { steps: 5 });
    await page.mouse.up();

    // Verify localStorage has saved dimensions
    const stored = await page.evaluate(() => {
      return localStorage.getItem("expense_tracker_panel_dimensions");
    });
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.heights["panel-category-trends"]).toBeGreaterThan(450);

    // Reload page
    await page.reload();
    const resumeBtn = page.getByRole("button", { name: "Continuar sesión" });
    await expect(resumeBtn).toBeVisible({ timeout: 10000 });
    await resumeBtn.click();
    await expect(page.locator("#dashboard-root")).toBeVisible({ timeout: 10000 });

    const panel1 = page.locator("#panel-category-trends");
    const reloadedBox1 = await panel1.boundingBox();
    expect(reloadedBox1!.height).toBeGreaterThan(450);
  });

  test("header 'Restablecer tamaños' button resets dimensions to defaults", async ({ page }) => {
    // First, modify dimensions
    const handle1 = page.locator("#resize-handle-panel-category-trends");
    const handleBox = await handle1.boundingBox();

    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + handleBox!.width / 2 + 50, handleBox!.y + handleBox!.height / 2 + 100, { steps: 5 });
    await page.mouse.up();

    // Click 'Restablecer tamaños' in header
    const resetBtn = page.locator("#btn-reset-panel-sizes");
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Verify panel height returned to default ~440px
    const panel1 = page.locator("#panel-category-trends");
    await expect(panel1).toHaveCSS("height", "440px");
    const resetBox = await panel1.boundingBox();
    expect(Math.abs(resetBox!.height - 440)).toBeLessThan(20);

    // Verify localStorage was reset
    const stored = await page.evaluate(() => {
      return localStorage.getItem("expense_tracker_panel_dimensions");
    });
    expect(stored).toBeNull();
  });
});
