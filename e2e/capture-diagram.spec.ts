import { test, expect } from "@playwright/test";
import path from "path";

test("Capture high-res architecture diagram screenshot", async ({ page }) => {
  const htmlPath = path.resolve(process.cwd(), "architecture-diagram.html");
  const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");

  await page.setViewportSize({ width: 1300, height: 1100 });
  await page.goto(fileUrl);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  const container = page.locator("#report-container");
  await expect(container).toBeVisible();

  const outputPath = path.resolve(process.cwd(), "architecture-diagram.png");
  await container.screenshot({ path: outputPath });
  console.log("[Playwright] ✓ Saved architecture-diagram.png");
});
