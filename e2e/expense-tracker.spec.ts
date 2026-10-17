import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Expense Tracker E2E - Playwright Automated Workflow", () => {
  test("clears prior session if present, ingests 2026-09.pdf and 2026-07.pdf, verifies 9 unclassified expenses, creates Testing category and classifies all 9", async ({
    page,
  }) => {
    // 1. Navigate to the application
    console.log("[E2E Test] Navigating to http://localhost:3000...");
    await page.goto("/");

    // 2. Start a new session: If previous data exists, use the "Borrar mis datos" option
    const clearDataBtn = page.getByRole("button", { name: "Borrar mis datos" });
    const hasPreviousData = await clearDataBtn
      .first()
      .isVisible({ timeout: 2500 })
      .catch(() => false);

    if (hasPreviousData) {
      console.log("[E2E Test] Previous session detected. Clicking 'Borrar mis datos'...");
      await clearDataBtn.first().click();

      // Confirm deletion in the confirmation modal
      const modalConfirmBtn = page.locator("button.bg-red-600", {
        hasText: "Borrar mis datos",
      });
      await expect(modalConfirmBtn).toBeVisible({ timeout: 5000 });
      await modalConfirmBtn.click();

      // Wait for modal to close
      await expect(page.getByText("¿Borrar todos mis datos?")).not.toBeVisible();
      console.log("[E2E Test] ✓ Previous session data cleared successfully.");
    } else {
      console.log("[E2E Test] Starting clean session (no previous data found).");
    }

    // 3. Ensure the file input element is ready
    const fileInput = page.locator("#file-upload-input");
    await expect(fileInput).toBeAttached();

    // Upload 2026-09.pdf and 2026-07.pdf without user interaction
    const pdfPath1 = path.resolve(process.cwd(), "demo", "2026-09.pdf");
    const pdfPath2 = path.resolve(process.cwd(), "demo", "2026-07.pdf");

    console.log(`[E2E Test] Automated file upload: \n  - ${pdfPath1}\n  - ${pdfPath2}`);
    await fileInput.setInputFiles([pdfPath1, pdfPath2]);

    // Verify batch staging display
    await expect(page.getByText("2 archivos listos para procesar")).toBeVisible();
    await expect(page.getByText("2026-09.pdf")).toBeVisible();
    await expect(page.getByText("2026-07.pdf")).toBeVisible();

    // Click confirm batch routing button
    const confirmRoutingBtn = page.locator("#btn-confirm-routing");
    await expect(confirmRoutingBtn).toBeVisible();
    await confirmRoutingBtn.click();

    // 4. Wait for processing to complete and the transaction table to display
    await expect(page.getByText("Movimientos extraídos")).toBeVisible({ timeout: 30000 });
    console.log("[E2E Test] ✓ Bank statements processed and transaction table displayed.");

    // 5. Verify that this produces exactly 9 unclassified expenses
    const pendingNotice = page.getByText(/Tienes 9 gastos pendientes de clasificar/i);
    await expect(pendingNotice).toBeVisible();

    const pendingPill = page
      .locator("button")
      .filter({ hasText: /^Pendiente\s*\(9\)/ });
    await expect(pendingPill).toBeVisible();
    console.log("[E2E Test] ✓ Confirmed: Exactly 9 unclassified expenses identified.");

    // 6. Create a "Testing" category
    console.log("[E2E Test] Opening 'Nueva categoría' dialog...");
    const newCategoryBtn = page
      .getByRole("button", { name: "Nueva categoría" })
      .first();
    await newCategoryBtn.click();

    // Fill in category name "Testing"
    const categoryNameInput = page.locator("#category-name-input");
    await expect(categoryNameInput).toBeVisible();
    await categoryNameInput.fill("Testing");

    // Save custom category
    const saveCategoryBtn = page.getByRole("button", { name: "Guardar categoría" });
    await saveCategoryBtn.click();

    // Modal closes
    await expect(categoryNameInput).not.toBeVisible();
    console.log("[E2E Test] ✓ 'Testing' category created successfully.");

    // 7. Classify the 9 unclassified expenses as "Testing"
    console.log("[E2E Test] Filtering table to view pending expenses...");
    await pendingPill.click();

    // Select all filtered pending items via table header checkbox
    const selectAllCheckbox = page.locator(
      'input[aria-label="Seleccionar todas las transacciones filtradas"]'
    );
    await selectAllCheckbox.check();

    // Choose "Testing" in the bulk category select
    const bulkCategorySelect = page.locator("#bulk-cat-select");
    await expect(bulkCategorySelect).toBeVisible();
    await bulkCategorySelect.selectOption("Testing");

    // Click "Guardar" in the bulk toolbar
    const bulkSaveBtn = page.locator("#btn-apply-bulk-category");
    await expect(bulkSaveBtn).toBeEnabled();
    await bulkSaveBtn.click();

    // 8. Assertions:
    // - Pending triage banner disappears and full Expense Dashboard appears
    await expect(page.getByText("Total de gastos del mes")).toBeVisible();

    // - The "Testing" category pill now displays (9)
    const testingPillWithCount = page
      .locator("button")
      .filter({ hasText: /^Testing\s*\(9\)/ });
    await expect(testingPillWithCount).toBeVisible();

    // - Filter to "Testing" and verify all 9 rows show the Testing category
    await testingPillWithCount.click();
    const tableRows = page.locator("tbody tr");
    await expect(tableRows).toHaveCount(9);

    // Verify first row select value is "Testing"
    const firstRowSelect = tableRows.first().locator("select");
    await expect(firstRowSelect).toHaveValue("Testing");

    console.log("[E2E Test] ✓ All 9 expenses successfully classified as 'Testing'.");
  });
});
