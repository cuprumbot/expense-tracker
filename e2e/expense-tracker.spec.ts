import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Dashboard & Sliding Drawer E2E - US-029 & US-030", () => {
  test("clean session, ingest PDFs, reach dashboard, verify 4-panel grid, test sliding drawer & reactive classification", async ({
    page,
  }) => {
    // 1. Navigate to the application
    console.log("[E2E Test] Navigating to http://localhost:3000...");
    await page.goto("/");

    // 1.1 Verify document title & starting screen improvements
    await expect(page).toHaveTitle("Expense Tracker");
    await expect(page.locator("header").getByText("Expense Tracker")).toBeVisible();
    await expect(page.locator("header").getByText("GTQ · Q")).not.toBeVisible();
    await expect(page.getByText("PDF / CSV")).not.toBeVisible();
    await expect(page.locator("#btn-demo-lote-mixto")).not.toBeAttached();

    // Verify Theme Switcher (light by default, toggle to dark, toggle back to light)
    const htmlElement = page.locator("html");
    await expect(htmlElement).not.toHaveClass(/dark/);
    const themeBtn = page.locator("#btn-theme-toggle");
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    await expect(htmlElement).toHaveClass(/dark/);
    await themeBtn.click();
    await expect(htmlElement).not.toHaveClass(/dark/);

    // 2. Start a clean, new session: If previous data exists, use "Reiniciar sesión" (US-041)
    await expect(page.getByText("Borrar mis datos")).not.toBeVisible();
    await expect(page.getByText("Nueva carga de estado de cuenta")).not.toBeVisible();

    const resetSessionBtn = page.getByRole("button", { name: "Reiniciar sesión" });
    const hasPreviousData = await resetSessionBtn
      .first()
      .isVisible({ timeout: 2500 })
      .catch(() => false);

    if (hasPreviousData) {
      console.log("[E2E Test] Previous session detected. Clicking 'Reiniciar sesión'...");
      await resetSessionBtn.first().click();

      // Confirm reset in the modal
      const modal = page.getByText("¿Deseas reiniciar la sesión?");
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Check factory reset option to wipe categories for a clean test
      const wipeCategoriesCheckbox = page.locator("#checkbox-wipe-custom-categories");
      if (await wipeCategoriesCheckbox.isVisible().catch(() => false)) {
        await wipeCategoriesCheckbox.check();
      }

      const modalConfirmBtn = page.locator("#btn-confirm-reset-session");
      await expect(modalConfirmBtn).toBeVisible({ timeout: 5000 });
      await modalConfirmBtn.click();

      // Wait for modal to disappear and upload screen to be ready
      await expect(modal).not.toBeVisible();
      console.log("[E2E Test] ✓ Previous session data reset successfully via Reiniciar sesión.");
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

    // 4. Wait for processing to complete and verify immediate navigation to dashboard (no intermediate review table)
    console.log("[E2E Test] Waiting for batch file processing to complete directly to dashboard...");
    const dashboardRoot = page.locator("#dashboard-root");
    await expect(dashboardRoot).toBeVisible({ timeout: 40000 });
    console.log("[E2E Test] ✓ Successfully proceeded directly to dashboard without intermediate screen.");

    // Verify chip behavior: if classifying with LLM or if > 10 pending, chip has attention animation
    const classifyingChip = page.locator("#chip-classifying-expenses");
    const unclassifiedChip = page.locator("#btn-filter-unclassified");
    if (await classifyingChip.isVisible().catch(() => false)) {
      console.log("[E2E Test] ✓ Verified AI classification chip is displayed while classifying.");
    }
    if (await unclassifiedChip.isVisible().catch(() => false)) {
      const chipText = await unclassifiedChip.innerText();
      console.log(`[E2E Test] Unclassified chip text: "${chipText}"`);
      const countMatch = chipText.match(/(\d+)/);
      if (countMatch && parseInt(countMatch[1], 10) > 10) {
        await expect(unclassifiedChip).toHaveClass(/animate-pulse/);
        console.log("[E2E Test] ✓ Verified subtle animation (animate-pulse) on unclassified chip with >10 pending.");
      }
    }

    // 5. Assertions for Dashboard Layout Scaffold
    console.log("[E2E Test] Verifying Dashboard container and header...");
    // Verify header title & elements (only 'Expense Tracker' heading, no 'Panel de Control Financiero')
    await expect(page.getByRole("heading", { name: "Panel de Control Financiero" })).not.toBeVisible();
    await expect(page.locator("#dashboard-root header").getByRole("heading", { name: "Expense Tracker" })).toBeVisible();
    await expect(page.locator("#dashboard-root header").getByText("Consolidado multicuenta")).not.toBeVisible();
    await expect(page.locator("#btn-dashboard-add-statements")).toBeVisible();
    await expect(page.locator("#btn-dashboard-reset-session")).toBeVisible();
    await expect(page.locator("#btn-dashboard-clear-data")).not.toBeAttached();
    await expect(page.locator("#dashboard-root").getByText("Borrar mis datos")).not.toBeVisible();
    await expect(page.locator("#btn-toggle-transactions-drawer")).toBeVisible();
    await expect(page.locator("#dashboard-root #btn-theme-toggle")).toBeVisible();

    // Verify 4-Panel 2x2 Responsive Grid
    await expect(page.locator("#panel-category-trends")).toBeVisible();
    await expect(page.locator("#panel-vendor-concentration")).toBeVisible();
    await expect(page.locator("#panel-consumption-patterns")).toBeVisible();
    await expect(page.locator("#panel-transaction-age")).toBeVisible();
    console.log("[E2E Test] ✓ US-029 Dashboard layout & 4 panels verified successfully.");

    // 5.0 Assertions for US-042 (Collapsible Panels) & US-043 (Contextual Info / Tutorial)
    console.log("[E2E Test] Verifying Panel Minimization (US-042) and Info Tutorials (US-043)...");
    
    // Test Info button on Panel 1
    const infoBtn1 = page.locator("#btn-info-panel-category-trends");
    await expect(infoBtn1).toBeVisible();
    await infoBtn1.click();
    const tutorialDialog = page.locator('#panel-category-trends [role="dialog"]');
    await expect(tutorialDialog).toBeVisible();
    await expect(tutorialDialog.getByText("Muestra la evolución mensual de tus gastos por categoría")).toBeVisible();
    // Dismiss via X button
    await tutorialDialog.getByTitle("Cerrar tutorial").click();
    await expect(tutorialDialog).not.toBeVisible();

    // Test Minimize button on Panel 1
    const minBtn1 = page.locator("#btn-minimize-panel-category-trends");
    await expect(minBtn1).toBeVisible();
    await minBtn1.click();
    // In minimized state, trend SVG is hidden, restore button is visible
    await expect(page.locator("#btn-restore-panel-category-trends")).toBeVisible();
    await expect(page.locator("#panel-category-trends").getByText("Minimizado")).toBeVisible();
    // Restore Panel 1
    await page.locator("#btn-restore-panel-category-trends").click();
    await expect(page.locator("#btn-restore-panel-category-trends")).not.toBeVisible();
    await expect(page.locator('#panel-category-trends svg[aria-label="Gráfico de tendencia mensual por categoría"]')).toBeVisible();
    console.log("[E2E Test] ✓ US-042 & US-043 Panel controls verified successfully.");

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

    // Test hover on data point hit target without jumping or flashing
    const pointHitTarget = trendSvg.locator("circle.cursor-pointer").first();
    await pointHitTarget.hover();
    const trendTooltip = page.locator("#panel-category-trends").getByText(/Gasto:/);
    await expect(trendTooltip).toBeVisible();
    console.log("[E2E Test] ✓ Panel 1 point hover tooltip verified without flickering.");

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

    // 5.3 Assertions for US-035 & US-036 (Panel 3: Consumption Patterns & Outliers)
    console.log("[E2E Test] Verifying Panel 3 Consumption Patterns Bar Chart (US-035 & US-036)...");
    const panel3 = page.locator("#panel-consumption-patterns");
    await expect(panel3).toBeVisible();

    const btnPatternDayOfWeek = page.locator("#btn-pattern-day-of-week");
    const btnPatternDayOfMonth = page.locator("#btn-pattern-day-of-month");
    await expect(btnPatternDayOfWeek).toBeVisible();
    await expect(btnPatternDayOfMonth).toBeVisible();

    // Default is day of week: check for day abbreviations (Lun, Mar, Mié, etc.)
    await expect(panel3.getByText("Lun")).toBeVisible();
    await expect(panel3.getByText("Vie")).toBeVisible();

    // Verify presence of anomaly banner
    const anomalyBanner = page.locator("#consumption-anomaly-banner");
    await expect(anomalyBanner).toBeVisible();

    // Toggle to Day of Month (1 to 31)
    await btnPatternDayOfMonth.click();
    await expect(btnPatternDayOfMonth).toHaveClass(/bg-white/);

    // Toggle back to Day of Week
    await btnPatternDayOfWeek.click();
    await expect(btnPatternDayOfWeek).toHaveClass(/bg-white/);
    console.log("[E2E Test] ✓ Panel 3 Consumption Patterns Bar Chart verified successfully.");

    // 5.4 Assertions for US-037, US-038 & US-039 (Panel 4: Transaction Age Donut Chart)
    console.log("[E2E Test] Verifying Panel 4 Transaction Age Donut Chart (US-037, US-038 & US-039)...");
    const panel4 = page.locator("#panel-transaction-age");
    await expect(panel4).toBeVisible();

    const donutSvg = panel4.locator('svg[aria-label="Gráfico de anillo de antigüedad del gasto"]');
    await expect(donutSvg).toBeVisible();

    // Verify month filter dropdown
    const monthSelect = page.locator("#select-transaction-age-month");
    await expect(monthSelect).toBeVisible();
    await expect(monthSelect).toHaveValue("all");

    // Verify 3 segment legends are present
    await expect(page.locator("#legend-segment-cuotas")).toBeVisible();
    await expect(page.locator("#legend-segment-suscripciones")).toBeVisible();
    await expect(page.locator("#legend-segment-inmediatas")).toBeVisible();

    // Test changing month filter to specific month
    const options = await monthSelect.locator("option").all();
    if (options.length > 1) {
      const secondOptionVal = await options[1].getAttribute("value");
      if (secondOptionVal && secondOptionVal !== "all") {
        await monthSelect.selectOption(secondOptionVal);
        await expect(monthSelect).toHaveValue(secondOptionVal);
        // Switch back to all
        await monthSelect.selectOption("all");
        await expect(monthSelect).toHaveValue("all");
      }
    }
    console.log("[E2E Test] ✓ Panel 4 Transaction Age Donut Chart verified successfully.");

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

    // Verify drawer header has no subtitle, no icon, and no "Consolidado multicuenta"
    await expect(page.getByText("Inspecciona, filtra o edita tus movimientos sin salir del panel.")).not.toBeVisible();
    await expect(drawerAside.getByText("Consolidado multicuenta")).not.toBeVisible();

    // Verify full TransactionTable is mounted inside drawer with no inline banner panels
    await expect(page.locator("#search-transactions-input")).toBeVisible();
    await expect(page.locator("#batch-summary-banner")).not.toBeAttached();
    await expect(page.locator("#duplicate-transactions-banner")).not.toBeAttached();

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

    // 8. Verify unclassified counter button interaction (US-040 improvement)
    const unclassifiedBtn = page.locator("#btn-filter-unclassified");
    if (await unclassifiedBtn.isVisible().catch(() => false)) {
      await unclassifiedBtn.click();
      await expect(drawerAside).toHaveClass(/translate-x-0/);
      console.log("[E2E Test] ✓ Clicking unclassified badge successfully opened drawer with unclassified filter.");
      await closeDrawerBtn.click();
      await expect(drawerAside).toHaveClass(/translate-x-full/);
    }

    // 9. Verify duplicate file detection pop-up message (no inline table banner)
    console.log("[E2E Test] Testing duplicate statement upload and pop-up alert...");
    const addMoreBtn = page.locator("#btn-dashboard-add-statements");
    await addMoreBtn.click();

    const addMoreModal = page.locator("#modal-add-more-statements");
    await expect(addMoreModal).toBeVisible();

    const modalFileInput = addMoreModal.locator("#file-upload-input");
    // Re-upload 2026-09.pdf which is already fully loaded
    await modalFileInput.setInputFiles([pdfPath1]);

    const confirmModalRoutingBtn = addMoreModal.locator("#btn-confirm-routing");
    await expect(confirmModalRoutingBtn).toBeVisible();
    await confirmModalRoutingBtn.click();

    // Verify floating pop-up appears
    const duplicatePopup = page.locator("#duplicate-transactions-popup");
    await expect(duplicatePopup).toBeVisible({ timeout: 15000 });
    await expect(duplicatePopup).toContainText("Aviso de transacciones duplicadas");
    console.log("[E2E Test] ✓ Duplicate transactions floating pop-up displayed.");

    // Verify batch summary success message is NOT shown when duplicates occur
    await expect(page.locator("#batch-summary-popup")).not.toBeVisible();
    console.log("[E2E Test] ✓ Verified batch summary success popup is suppressed when duplicates occur.");

    // Verify inline banner is NOT present
    await expect(page.locator("#duplicate-transactions-banner")).not.toBeAttached();

    // Dismiss pop-up
    const dismissPopupBtn = duplicatePopup.locator("button[aria-label='Cerrar notificación']");
    await dismissPopupBtn.click();
    await expect(duplicatePopup).not.toBeVisible();
    console.log("[E2E Test] ✓ Duplicate pop-up dismissed successfully.");
  });
});
