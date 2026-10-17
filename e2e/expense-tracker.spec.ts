import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Dashboard & Sliding Drawer E2E - US-029 & US-030", () => {
  test("clean session, ingest PDFs, reach dashboard, verify 4-panel grid, test sliding drawer & reactive classification", async ({
    page,
  }) => {
    // 1. Navigate to the application
    console.log("[E2E Test] Navigating to http://localhost:3000...");
    await page.goto("/");

    // 2. Start a clean, new session: If previous data exists, use "Borrar mis datos"
    const clearDataBtn = page.getByRole("button", { name: "Borrar mis datos" });
    const hasPreviousData = await clearDataBtn
      .first()
      .isVisible({ timeout: 2500 })
      .catch(() => false);

    if (hasPreviousData) {
      console.log("[E2E Test] Previous session detected. Clicking 'Borrar mis datos'...");
      await clearDataBtn.first().click();

      // Confirm deletion in the modal
      const modalConfirmBtn = page.locator("button.bg-red-600", {
        hasText: "Borrar mis datos",
      });
      await expect(modalConfirmBtn).toBeVisible({ timeout: 5000 });
      await modalConfirmBtn.click();

      // Wait for modal to disappear and upload screen to be ready
      await expect(page.getByText("¿Borrar todos mis datos?")).not.toBeVisible();
      console.log("[E2E Test] ✓ Previous session data cleared successfully.");
    } else {
      console.log("[E2E Test] Clean session confirmed (no previous session data).");
    }

    // 3. Ensure the file upload input element is ready
    const fileInput = page.locator("#file-upload-input");
    await expect(fileInput).toBeAttached();

    // Programmatically upload 2026-09.pdf and 2026-07.pdf without user interaction
    const pdfPath1 = path.resolve(process.cwd(), "demo", "2026-09.pdf");
    const pdfPath2 = path.resolve(process.cwd(), "demo", "2026-07.pdf");

    console.log(`[E2E Test] Programmatic file upload: \n  - ${pdfPath1}\n  - ${pdfPath2}`);
    await fileInput.setInputFiles([pdfPath1, pdfPath2]);

    // Verify batch staging displays both files
    await expect(page.getByText("2 archivos listos para procesar")).toBeVisible();
    await expect(page.getByText("2026-09.pdf")).toBeVisible();
    await expect(page.getByText("2026-07.pdf")).toBeVisible();

    // Click confirm batch routing button
    const confirmRoutingBtn = page.locator("#btn-confirm-routing");
    await expect(confirmRoutingBtn).toBeVisible();
    await confirmRoutingBtn.click();

    // 4. Wait for processing to complete and verify whether dashboard or review screen appears
    console.log("[E2E Test] Waiting for batch file processing to complete...");
    const dashboardOrReview = page.locator("#dashboard-root, table");
    await dashboardOrReview.first().waitFor({ state: "visible", timeout: 40000 });

    const isDashboardActive = await page.locator("#dashboard-root").isVisible();

    if (!isDashboardActive) {
      console.log("[E2E Test] Pending >= 10 detected: Classifying expenses to proceed to dashboard...");
      // Filter pending expenses and classify
      const pendingPill = page.locator("button").filter({ hasText: /^Pendiente/ });
      await expect(pendingPill).toBeVisible();
      await pendingPill.click();

      // Create "Testing" category
      const newCategoryBtn = page.getByRole("button", { name: "Nueva categoría" }).first();
      await newCategoryBtn.click();
      const categoryNameInput = page.locator("#category-name-input");
      await categoryNameInput.fill("Testing");
      await page.getByRole("button", { name: "Guardar categoría" }).click();

      // Bulk classify
      const selectAllCheckbox = page.locator('input[aria-label="Seleccionar todas las transacciones filtradas"]');
      await selectAllCheckbox.check();
      const bulkCategorySelect = page.locator("#bulk-cat-select");
      await bulkCategorySelect.selectOption("Testing");
      const bulkSaveBtn = page.locator("#btn-apply-bulk-category");
      await bulkSaveBtn.click();
    }

    // 5. Assertions for US-029 (Dashboard Layout Scaffold)
    console.log("[E2E Test] Verifying Dashboard container (US-029)...");
    const dashboardRoot = page.locator("#dashboard-root");
    await expect(dashboardRoot).toBeVisible({ timeout: 15000 });

    // Verify header title & elements
    await expect(page.getByRole("heading", { name: "Panel de Control Financiero" })).toBeVisible();
    await expect(page.locator("#btn-dashboard-add-statements")).toBeVisible();
    await expect(page.locator("#btn-dashboard-reset-session")).toBeVisible();
    await expect(page.locator("#btn-toggle-transactions-drawer")).toBeVisible();

    // Verify 4-Panel 2x2 Responsive Grid
    await expect(page.locator("#panel-category-trends")).toBeVisible();
    await expect(page.locator("#panel-vendor-concentration")).toBeVisible();
    await expect(page.locator("#panel-consumption-patterns")).toBeVisible();
    await expect(page.locator("#panel-transaction-age")).toBeVisible();
    console.log("[E2E Test] ✓ US-029 Dashboard layout & 4 panels verified successfully.");

    // 5.1 Assertions for US-031 & US-032 (Panel 1: Category Trends Line Chart)
    console.log("[E2E Test] Verifying Panel 1 Category Trend Line Chart (US-031 & US-032)...");
    const trendSvg = page.locator('#panel-category-trends svg[aria-label="Gráfico de tendencia mensual por categoría"]');
    await expect(trendSvg).toBeVisible();

    // Check that months are present on X-axis (Jul 2026, Sep 2026)
    await expect(trendSvg.getByText("Jul 2026")).toBeVisible();
    await expect(trendSvg.getByText("Sep 2026")).toBeVisible();

    // Check SVG paths and circles
    const svgPaths = trendSvg.locator("path");
    await expect(svgPaths.first()).toBeVisible();
    const svgCircles = trendSvg.locator("circle");
    expect(await svgCircles.count()).toBeGreaterThan(0);

    // Check category filter pill toggling in Panel 1
    const panel1Pills = page.locator("#panel-category-trends button").filter({ hasText: /Supermercado/ });
    if (await panel1Pills.first().isVisible().catch(() => false)) {
      await panel1Pills.first().click();
      await expect(panel1Pills.first()).toHaveClass(/line-through/);
      // Toggle back on
      await panel1Pills.first().click();
      await expect(panel1Pills.first()).not.toHaveClass(/line-through/);
    }
    console.log("[E2E Test] ✓ Panel 1 Category Trend Line Chart verified successfully.");

    // 5.2 Assertions for US-033 & US-034 (Panel 2: Top Vendors Dual-Metric Bar Chart)
    console.log("[E2E Test] Verifying Panel 2 Top Vendors Bar Chart (US-033 & US-034)...");
    const panel2 = page.locator("#panel-vendor-concentration");
    await expect(panel2).toBeVisible();

    const btnSortAmount = page.locator("#btn-vendor-sort-amount");
    const btnSortFrequency = page.locator("#btn-vendor-sort-frequency");
    await expect(btnSortAmount).toBeVisible();
    await expect(btnSortFrequency).toBeVisible();

    // Default is sort by amount: check for Quetzales format in items
    await expect(panel2.getByText(/Q\s*[\d,]+\.\d{2}/).first()).toBeVisible();

    // Toggle to sort by frequency
    await btnSortFrequency.click();
    await expect(btnSortFrequency).toHaveClass(/bg-white/);
    await expect(panel2.getByText(/compras?/i).first()).toBeVisible();

    // Toggle back to amount
    await btnSortAmount.click();
    await expect(btnSortAmount).toHaveClass(/bg-white/);
    console.log("[E2E Test] ✓ Panel 2 Top Vendors Bar Chart verified successfully.");

    // 6. Assertions for US-030 (Sliding Transaction Drawer)
    console.log("[E2E Test] Testing Sliding Transaction Drawer (US-030)...");

    // Drawer should be off-canvas initially
    const drawerAside = page.locator('aside[aria-label="Detalle de movimientos"]');
    await expect(drawerAside).toHaveClass(/translate-x-full/);

    // Click "Ver transacciones" to open drawer
    const openDrawerBtn = page.locator("#btn-toggle-transactions-drawer");
    await openDrawerBtn.click();

    // Drawer slides in
    await expect(drawerAside).toHaveClass(/translate-x-0/);
    console.log("[E2E Test] ✓ Drawer opened smoothly.");

    // Verify full TransactionTable is mounted inside drawer
    await expect(page.locator("#search-transactions-input")).toBeVisible();

    // Test inline custom category creation inside drawer
    const newCategoryBtn = page.getByRole("button", { name: "Nueva categoría" }).first();
    await newCategoryBtn.click();
    const categoryNameInput = page.locator("#category-name-input");
    await expect(categoryNameInput).toBeVisible();
    await categoryNameInput.fill("Testing");
    await page.getByRole("button", { name: "Guardar categoría" }).click();
    await expect(categoryNameInput).not.toBeVisible();
    console.log("[E2E Test] ✓ 'Testing' category created from within drawer.");

    // Filter pending transactions inside drawer
    const pendingFilterPill = page.locator("button").filter({ hasText: /^Pendiente/ });
    if (await pendingFilterPill.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("[E2E Test] Classifying pending transactions to 'Testing' from inside drawer...");
      await pendingFilterPill.click();

      const selectAllCheckbox = page.locator(
        'input[aria-label="Seleccionar todas las transacciones filtradas"]'
      );
      await selectAllCheckbox.check();

      const bulkCategorySelect = page.locator("#bulk-cat-select");
      await expect(bulkCategorySelect).toBeVisible();
      await bulkCategorySelect.selectOption("Testing");

      const bulkSaveBtn = page.locator("#btn-apply-bulk-category");
      await bulkSaveBtn.click();

      // Check that Testing category pill now reflects classified count
      const testingPill = page.locator("button").filter({ hasText: /^Testing/ });
      await expect(testingPill).toBeVisible();
    }

    // Test closing drawer via close button ("Ocultar transacciones")
    const closeDrawerBtn = page.locator("#btn-close-sliding-drawer");
    await expect(closeDrawerBtn).toBeVisible();
    await closeDrawerBtn.click();
    await expect(drawerAside).toHaveClass(/translate-x-full/);
    console.log("[E2E Test] ✓ Drawer closed via close button.");

    // Reopen drawer and test closing via Escape key
    await openDrawerBtn.click();
    await expect(drawerAside).toHaveClass(/translate-x-0/);
    await page.keyboard.press("Escape");
    await expect(drawerAside).toHaveClass(/translate-x-full/);
    console.log("[E2E Test] ✓ Drawer closed via Escape key.");

    // 7. Verify reactive dashboard updates
    // Total count should show 140 movimientos analizados
    await expect(page.getByText("140 movimientos analizados")).toBeVisible();
    console.log("[E2E Test] ✓ Reactive dashboard statistics verified.");
  });
});
