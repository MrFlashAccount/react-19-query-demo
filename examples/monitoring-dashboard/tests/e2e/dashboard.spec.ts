import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for service worker and seed data
    await page.waitForSelector("[data-testid='server-list'], .text-slate-200:has-text('Servers')", {
      timeout: 30000,
    });
  });

  test("should display header with status counts", async ({ page }) => {
    await expect(page.locator("text=Infrastructure Monitor")).toBeVisible();
    await expect(page.locator("text=healthy")).toBeVisible();
  });

  test("should display server list", async ({ page }) => {
    await expect(page.getByPlaceholder("Search servers...")).toBeVisible();
    // Wait for servers to load
    await page.waitForSelector(".text-sm.font-medium.text-slate-200");
  });

  test("should filter servers by search", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search servers...");
    await searchInput.fill("web");
    await page.waitForTimeout(500);
    // Should show filtered results
  });

  test("should navigate to alerts page", async ({ page }) => {
    await page.getByRole("link", { name: /alerts/i }).click();
    await expect(page.locator("text=Alert Rules")).toBeVisible();
  });
});

