import { expect, test, type Page } from "@playwright/test";

async function gotoTodoApp(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveTitle(/RSC TodoMVC Integration/i);
  await expect(page.getByRole("heading", { name: "todos" })).toBeVisible();
  await expect(page.getByText("Read worker transport docs")).toBeVisible();
  await expect(page.getByText("Loading from worker...")).toHaveCount(0);
  await expect(page.locator(".todo-error")).toHaveCount(0);
}

const workerRuntimeErrorPatterns = [
  /expects a "use worker" component reference/,
  /expects a "use worker" action reference/,
  /Missing or unknown worker component reference/,
  /Worker component references cannot render on the main thread/,
];

const pageErrors = new WeakMap<Page, string[]>();

test.describe("TodoMVC integration", () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    pageErrors.set(page, errors);
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    await gotoTodoApp(page);
  });

  test.afterEach(async ({ page }) => {
    const errors = pageErrors.get(page) ?? [];
    const workerErrors = errors.filter((error) =>
      workerRuntimeErrorPatterns.some((pattern) => pattern.test(error)),
    );
    expect(workerErrors).toEqual([]);
  });

  test("adds a todo", async ({ page }) => {
    const newTodo = "Playwright add flow";
    await page.getByRole("textbox", { name: "New todo" }).fill(newTodo);
    await page.getByRole("textbox", { name: "New todo" }).press("Enter");

    await expect(page.getByText(newTodo)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: `Toggle ${newTodo}` })).not.toBeChecked();
  });

  test("removes a todo", async ({ page }) => {
    await page.getByRole("button", { name: "Delete Ship TodoMVC scenario" }).click();
    await expect(page.getByText("Ship TodoMVC scenario")).toHaveCount(0);
  });

  test("edits a todo title", async ({ page }) => {
    const currentTitle = "Read worker transport docs";
    const nextTitle = "Read worker transport docs deeply";

    await page.locator(".todo-label", { hasText: currentTitle }).dblclick();
    await page.locator("input.todo-edit").fill(nextTitle);
    await page.locator("input.todo-edit").press("Enter");

    await expect(page.getByText(nextTitle)).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: /^Toggle Read worker transport docs$/ }),
    ).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: `Toggle ${nextTitle}` })).toBeVisible();
  });

  test("checks and unchecks a todo", async ({ page }) => {
    const target = page.getByRole("checkbox", { name: "Toggle Read worker transport docs" });

    await target.click();
    await expect(target).toBeChecked();

    await target.click();
    await expect(target).not.toBeChecked();

    await target.click();
    await expect(target).toBeChecked();

    await target.click();
    await expect(target).not.toBeChecked();
  });

  test("filters todos by all states", async ({ page }) => {
    const activeTodo = "Ship TodoMVC scenario";
    const completedTodo = "Verify RSC refresh cycle";

    await page.getByRole("link", { name: "Active" }).click();
    await expect(page).toHaveURL(/filter=active/);
    await expect(page.getByText(activeTodo)).toBeVisible();
    await expect(page.getByText(completedTodo)).toHaveCount(0);

    await page.getByRole("link", { name: "Completed" }).click();
    await expect(page).toHaveURL(/filter=completed/);
    await expect(page.getByText(completedTodo)).toBeVisible();
    await expect(page.getByText(activeTodo)).toHaveCount(0);

    await page.getByRole("link", { name: "All" }).click();
    await expect(page).not.toHaveURL(/filter=/);
    await expect(page.getByText(activeTodo)).toBeVisible();
    await expect(page.getByText(completedTodo)).toBeVisible();
  });
});
