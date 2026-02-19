import { test, expect } from "@playwright/test";

test("loads the app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/MovieDB/i);
});

test("rsc rating action rerenders movie card", async ({ page }) => {
  await page.goto("/");

  const cards = page.locator("div.group.bg-white");
  const firstCard = cards.first();
  await expect(firstCard).toBeVisible();

  const ratingBadge = firstCard.locator("span.bg-black.text-white").first();
  await expect(ratingBadge).toBeVisible();

  const initialRatingText = (await ratingBadge.textContent())?.trim() ?? "";
  const initialRating = Number.parseFloat(initialRatingText);
  const setToLowRating = Number.isFinite(initialRating) && initialRating >= 9.9;
  const targetStarIndex = setToLowRating ? 0 : 4;
  const targetRatingText = setToLowRating ? "2.0" : "10.0";

  const ratingButtons = firstCard.locator("button");
  await expect(ratingButtons).toHaveCount(5);
  await ratingButtons.nth(targetStarIndex).click();

  await expect(ratingBadge).toHaveText(targetRatingText, { timeout: 15000 });
});
