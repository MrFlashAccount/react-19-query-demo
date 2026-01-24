import { test, expect } from "@playwright/test";

test.describe("Alerts Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/alerts");
    await page.waitForSelector("text=Alert Rules", { timeout: 30000 });
  });

  test("should display alert rules list", async ({ page }) => {
    await expect(page.locator("text=Alert Rules")).toBeVisible();
    // Default alerts should be seeded
    await expect(page.locator("text=High CPU Usage")).toBeVisible({ timeout: 10000 });
  });

  test("should open create alert dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Create Alert" }).click();
    await expect(page.locator("text=Alert Name")).toBeVisible();
  });

  test("should toggle alert enabled state", async ({ page }) => {
    // Find first switch and click it
    const switches = page.locator('[role="switch"]');
    const firstSwitch = switches.first();
    await firstSwitch.click();
    // Should toggle state
  });

  test("should open edit dialog", async ({ page }) => {
    // Click edit button on first alert
    const editButton = page.locator('button:has(svg path[d*="18.5 2.5"])').first();
    await editButton.click();
    await expect(page.locator("text=Edit Alert")).toBeVisible();
  });
});
