import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

test.describe("Capture Documentation Screenshots", () => {
  test("ingest statement PDFs and capture high quality screenshots for documentation", async ({
    page,
  }) => {
    // 1. Ensure target directory exists
    const screenshotsDir = path.resolve(process.cwd(), "docs", "screenshots");
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Set viewport to 1440x950 for clear layout
    await page.setViewportSize({ width: 1440, height: 950 });

    // 2. Navigate to application
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 3. Clean session if previous session exists
    const resetSessionBtn = page.getByRole("button", { name: "Reiniciar sesión" });
    const hasPreviousData = await resetSessionBtn
      .first()
      .isVisible({ timeout: 2500 })
      .catch(() => false);

    if (hasPreviousData) {
      await resetSessionBtn.first().click();
      const modal = page.getByText("¿Deseas reiniciar la sesión?");
      await expect(modal).toBeVisible({ timeout: 5000 });

      const wipeCategoriesCheckbox = page.locator("#checkbox-wipe-custom-categories");
      if (await wipeCategoriesCheckbox.isVisible().catch(() => false)) {
        await wipeCategoriesCheckbox.check();
      }

      const modalConfirmBtn = page.locator("#btn-confirm-reset-session");
      await modalConfirmBtn.click();
      await expect(modal).not.toBeVisible();
    }

    // 4. Ingest sample statements (2026-09.pdf and 2026-07.pdf)
    const fileInput = page.locator("#file-upload-input");
    await expect(fileInput).toBeAttached();

    const pdfPath1 = path.resolve(process.cwd(), "demo", "2026-09.pdf");
    const pdfPath2 = path.resolve(process.cwd(), "demo", "2026-07.pdf");
    await fileInput.setInputFiles([pdfPath1, pdfPath2]);

    await expect(page.getByText("2 archivos listos para procesar")).toBeVisible();
    const confirmRoutingBtn = page.locator("#btn-confirm-routing");
    await confirmRoutingBtn.click();

    // 5. Wait for direct navigation to the dashboard
    const dashboardRoot = page.locator("#dashboard-root");
    await expect(dashboardRoot).toBeVisible({ timeout: 45000 });

    // Wait for all 4 panels to render
    await expect(page.locator("#panel-category-trends")).toBeVisible();
    await expect(page.locator("#panel-vendor-concentration")).toBeVisible();
    await expect(page.locator("#panel-consumption-patterns")).toBeVisible();
    await expect(page.locator("#panel-transaction-age")).toBeVisible();

    // Wait 2 seconds for any chart animations or toasts to settle
    await page.waitForTimeout(2000);

    // Dismiss any toasts if present to keep screenshot clean
    const toasts = page.locator('[role="status"], [role="alert"]');
    const toastCount = await toasts.count();
    for (let i = 0; i < toastCount; i++) {
      const closeBtn = toasts.nth(i).locator("button");
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click().catch(() => {});
      }
    }
    await page.waitForTimeout(500);

    // 6. Screenshot 1: Full Dashboard in Light Mode
    console.log("[Playwright] Capturing docs/screenshots/dashboard-overview.png...");
    await page.screenshot({
      path: path.join(screenshotsDir, "dashboard-overview.png"),
      fullPage: false,
    });

    // 7. Screenshot 2: Sliding Drawer with Transactions
    console.log("[Playwright] Opening sliding drawer...");
    const drawerBtn = page.locator("#btn-toggle-transactions-drawer");
    await drawerBtn.click();
    const drawer = page.locator('aside[aria-label="Detalle de movimientos"]');
    await expect(drawer).toHaveClass(/translate-x-0/);
    await page.waitForTimeout(800);

    console.log("[Playwright] Capturing docs/screenshots/dashboard-drawer.png...");
    await page.screenshot({
      path: path.join(screenshotsDir, "dashboard-drawer.png"),
      fullPage: false,
    });

    // Close drawer
    const closeDrawerBtn = page.locator("#btn-close-sliding-drawer");
    if (await closeDrawerBtn.isVisible().catch(() => false)) {
      await closeDrawerBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(500);

    // 8. Screenshot 3: Dark Mode Dashboard
    console.log("[Playwright] Switching to dark mode...");
    const themeBtn = page.locator("#btn-theme-toggle");
    await themeBtn.click();
    await page.waitForTimeout(800);

    console.log("[Playwright] Capturing docs/screenshots/dashboard-dark.png...");
    await page.screenshot({
      path: path.join(screenshotsDir, "dashboard-dark.png"),
      fullPage: false,
    });

    // Switch back to light mode
    await themeBtn.click();
    await page.waitForTimeout(400);

    console.log("[Playwright] ✓ All screenshots captured successfully in docs/screenshots/");
  });
});
