import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

test.describe("Capture Comprehensive Documentation Screenshots", () => {
  test("navigates through all application functionality and captures high-res screenshots", async ({
    page,
  }) => {
    const screenshotsDir = path.resolve(process.cwd(), "docs", "screenshots");
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Set viewport to a clear standard desktop resolution
    await page.setViewportSize({ width: 1440, height: 950 });

    // --- 1. LANDING PAGE ---
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);

    console.log("[Playwright] 1. Capturing landing-overview.png...");
    await page.screenshot({
      path: path.join(screenshotsDir, "landing-overview.png"),
      fullPage: false,
    });

    // --- 2. SIMPLE LIST MODAL ("Lista rápida") ---
    console.log("[Playwright] 2. Opening simple list modal...");
    const openSimpleListBtn = page.locator("#btn-open-simple-list");
    await expect(openSimpleListBtn).toBeVisible();
    await openSimpleListBtn.click();

    const textarea = page.locator("#simple-list-textarea");
    await expect(textarea).toBeVisible();
    await textarea.fill("Walmart 450\n40 super 24\nGasolina Puma 200\nBurger King 75\nFarmacias Galeno 120");
    await page.waitForTimeout(600);

    console.log("[Playwright] Capturing simple-list-modal.png...");
    await page.screenshot({
      path: path.join(screenshotsDir, "simple-list-modal.png"),
      fullPage: false,
    });

    // Close simple list modal
    const cancelBtn = page.locator("#btn-close-simple-list");
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(500);

    // --- 3. INGEST SAMPLE STATEMENTS & DASHBOARD ---
    console.log("[Playwright] 3. Ingesting bank statements for dashboard...");
    const fileInput = page.locator("#file-upload-input");
    await expect(fileInput).toBeAttached();

    const pdfPath1 = path.resolve(process.cwd(), "demo", "2026-09.pdf");
    const pdfPath2 = path.resolve(process.cwd(), "demo", "2026-07.pdf");
    await fileInput.setInputFiles([pdfPath1, pdfPath2]);

    await expect(page.getByText("2 archivos listos para procesar")).toBeVisible();
    await page.locator("#btn-confirm-routing").click();

    // Wait for dashboard to render
    const dashboardRoot = page.locator("#dashboard-root");
    await expect(dashboardRoot).toBeVisible({ timeout: 45000 });
    await expect(page.locator("#panel-category-trends")).toBeVisible();
    await expect(page.locator("#panel-vendor-concentration")).toBeVisible();
    await expect(page.locator("#panel-consumption-patterns")).toBeVisible();
    await expect(page.locator("#panel-transaction-age")).toBeVisible();
    await page.waitForTimeout(2000);

    // Dismiss any toasts
    const toasts = page.locator('[role="status"], [role="alert"]');
    const toastCount = await toasts.count();
    for (let i = 0; i < toastCount; i++) {
      const closeBtn = toasts.nth(i).locator("button");
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click().catch(() => {});
      }
    }
    await page.waitForTimeout(400);

    console.log("[Playwright] Capturing dashboard-overview.png...");
    await page.screenshot({
      path: path.join(screenshotsDir, "dashboard-overview.png"),
      fullPage: false,
    });

    // --- 4. SLIDING DRAWER ---
    console.log("[Playwright] 4. Opening sliding drawer...");
    await page.locator("#btn-toggle-transactions-drawer").click();
    const drawer = page.locator('aside[aria-label="Detalle de movimientos"]');
    await expect(drawer).toHaveClass(/translate-x-0/);
    await page.waitForTimeout(800);

    console.log("[Playwright] Capturing dashboard-drawer.png...");
    await page.screenshot({
      path: path.join(screenshotsDir, "dashboard-drawer.png"),
      fullPage: false,
    });

    // Close sliding drawer
    const closeDrawerBtn = page.locator("#btn-close-sliding-drawer");
    if (await closeDrawerBtn.isVisible().catch(() => false)) {
      await closeDrawerBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(500);

    // --- 5. DARK MODE DASHBOARD ---
    console.log("[Playwright] 5. Toggling dark mode...");
    const themeBtn = page.locator("#btn-theme-toggle");
    await themeBtn.click();
    await page.waitForTimeout(800);

    console.log("[Playwright] Capturing dashboard-dark.png...");
    await page.screenshot({
      path: path.join(screenshotsDir, "dashboard-dark.png"),
      fullPage: false,
    });

    // Return to light mode
    await themeBtn.click();
    await page.waitForTimeout(500);

    // --- 6. BUDGET TOOL: BUILDER ---
    console.log("[Playwright] 6. Navigating to Budget Tool...");
    const openBudgetBtn = page.locator("#btn-dashboard-open-budget");
    await openBudgetBtn.click();
    await expect(page.getByRole("heading", { name: "Mi Presupuesto Mensual" })).toBeVisible();

    // In budget tool, we are on configure tab (since no budget is set yet)
    await expect(page.locator("#tab-configurar-presupuesto")).toBeVisible();
    // Click "Agregar categorías principales"
    const addMainBtn = page.locator("#btn-add-main-categories");
    if (await addMainBtn.isVisible()) {
      await addMainBtn.click();
      await page.waitForTimeout(500);
    }

    console.log("[Playwright] Capturing budget-tool-builder.png...");
    await page.screenshot({
      path: path.join(screenshotsDir, "budget-tool-builder.png"),
      fullPage: false,
    });

    // Save budget
    const saveBudgetBtn = page.locator("#btn-save-budget");
    await expect(saveBudgetBtn).toBeEnabled();
    await saveBudgetBtn.click();
    await page.waitForTimeout(1000);

    // --- 7. BUDGET TOOL: COMPARISON & STREAKS ---
    console.log("[Playwright] 7. Viewing budget comparativa tab...");
    await expect(page.locator("#section-comparativa-presupuesto")).toBeVisible();
    await page.waitForTimeout(800);

    console.log("[Playwright] Capturing budget-tool-overview.png...");
    await page.screenshot({
      path: path.join(screenshotsDir, "budget-tool-overview.png"),
      fullPage: false,
    });

    // --- 8. BUDGET TOOL: INSIGHTS & COACHING ---
    console.log("[Playwright] 8. Switching to suggestions & insights tab...");
    await page.locator("#tab-sugerencias-presupuesto").click();
    await expect(page.locator("#section-sugerencias-presupuesto")).toBeVisible();
    await page.waitForTimeout(800);

    console.log("[Playwright] Capturing budget-tool-insights.png...");
    await page.screenshot({
      path: path.join(screenshotsDir, "budget-tool-insights.png"),
      fullPage: false,
    });

    // --- 9. BUDGET TOOL: EDIT MODAL & SCOPE CONFIRMATION ---
    console.log("[Playwright] 9. Opening edit budget modal...");
    await page.locator("#tab-comparativa-presupuesto").click();
    const editBtn = page.locator("#btn-edit-budget-overview");
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);

      // Fine-tune an amount to make dirty
      const plusBtn = page.locator('[id^="target-card-"]').first().getByRole("button", { name: "+Q 100" });
      if (await plusBtn.isVisible()) {
        await plusBtn.click();
      }

      const saveEditBtn = page.locator("#btn-save-budget");
      if (await saveEditBtn.isEnabled()) {
        await saveEditBtn.click();
        await page.waitForTimeout(500);

        // Check if scope modal appears
        const scopeModal = page.locator("#modal-budget-scope");
        if (await scopeModal.isVisible().catch(() => false)) {
          console.log("[Playwright] Capturing budget-tool-scope-modal.png...");
          await page.screenshot({
            path: path.join(screenshotsDir, "budget-tool-scope-modal.png"),
            fullPage: false,
          });
          // Confirm
          await page.locator("#btn-scope-all-months").click();
        }
      }
    }

    console.log("[Playwright] ✓ All documentation screenshots captured successfully!");
  });
});
