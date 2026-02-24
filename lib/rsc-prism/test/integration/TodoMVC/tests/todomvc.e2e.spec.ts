import { expect, test, type Page } from "@playwright/test";

async function gotoTodoApp(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveTitle(/RSC TodoMVC Integration/i);
  await expect(page.getByRole("heading", { name: "todos" })).toBeVisible();
  await expect(page.getByText("Read worker transport docs")).toBeVisible();
  await expect(page.getByText("Loading from worker...")).toHaveCount(0);
  await expect(page.locator(".todo-error")).toHaveCount(0);
}

async function readMetricCount(page: Page, testId: string): Promise<number> {
  const text = await page.getByTestId(testId).textContent();
  const parsed = Number(text ?? "");
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid metric value for ${testId}: ${String(text)}`);
  }
  return parsed;
}

interface BrowserTraceEvent {
  kind: "start" | "event" | "end";
  spanId: string;
  parentSpanId?: string;
  name: string;
  payload?: Record<string, unknown>;
  status?: "success" | "error";
  timestamp: number;
}

interface BrowserTraceSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  payload?: Record<string, unknown>;
  status?: "success" | "error";
  duration?: number;
}

async function installTraceRecorder(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const tracer = (window as unknown as Record<string, unknown>).__rscPrismTracer as
      | { addReporter?: unknown }
      | undefined;
    return tracer != null && typeof tracer.addReporter === "function";
  });

  await page.evaluate(() => {
    const state = window as unknown as Record<string, unknown>;
    state.__rscPrismCapturedTraceEvents = [];
    const tracer = state.__rscPrismTracer as {
      addReporter: (reporter: { handleEvent: (event: unknown) => void }) => () => void;
    };
    const unsubscribe = tracer.addReporter({
      handleEvent(event) {
        const traceEvent = event as {
          kind: "start" | "event" | "end";
          span: { spanId: bigint; name: string; startTime: number; duration: number };
          parentSpan?: { spanId: bigint };
          name?: string;
          payload?: Record<string, unknown>;
          status?: "success" | "error";
          timestamp: number;
        };
        const output: BrowserTraceEvent = {
          kind: traceEvent.kind,
          spanId: String(traceEvent.span.spanId),
          parentSpanId:
            traceEvent.parentSpan == null ? undefined : String(traceEvent.parentSpan.spanId),
          name: traceEvent.kind === "start" ? traceEvent.name ?? traceEvent.span.name : traceEvent.span.name,
          payload: traceEvent.payload,
          status: traceEvent.status,
          timestamp: traceEvent.timestamp,
        };
        (state.__rscPrismCapturedTraceEvents as BrowserTraceEvent[]).push(output);
      },
    });
    state.__rscPrismDisposeTraceReporter = unsubscribe;
  });
}

async function disposeTraceRecorder(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state = window as unknown as Record<string, unknown>;
    const dispose = state.__rscPrismDisposeTraceReporter as (() => void) | undefined;
    if (typeof dispose === "function") {
      dispose();
    }
    delete state.__rscPrismDisposeTraceReporter;
  });
}

function buildSpans(events: BrowserTraceEvent[]): BrowserTraceSpan[] {
  const spans = new Map<string, BrowserTraceSpan & { startTime?: number; endTime?: number }>();
  for (const event of events) {
    const existing = spans.get(event.spanId);
    if (event.kind === "start") {
      spans.set(event.spanId, {
        spanId: event.spanId,
        parentSpanId: event.parentSpanId,
        name: event.name,
        payload: event.payload,
        startTime: event.timestamp,
      });
      continue;
    }
    if (existing == null) {
      continue;
    }
    if (event.kind === "end") {
      existing.status = event.status;
      existing.endTime = event.timestamp;
      existing.duration = Math.max(0, event.timestamp - (existing.startTime ?? event.timestamp));
    }
  }
  return Array.from(spans.values());
}

function spanMatches(span: BrowserTraceSpan, traceKey: string): boolean {
  if (span.name === traceKey) {
    return true;
  }

  const prefixesByTraceKey: Record<string, string[]> = {
    "rsc.action.call": ["Action Send"],
    "rsc.client.callServer": ["Action Send"],
    "rsc.react.rerender.fetch": ["Rerender Send Fetch"],
    "rsc.react.applyBatch": ["Rerender Decode Updates"],
    "rsc.component.decode": ["Decode #", "Decode:"],
  };

  const prefixes = prefixesByTraceKey[traceKey];
  if (prefixes == null) {
    return false;
  }
  return prefixes.some((prefix) => span.name.startsWith(prefix));
}

function isDescendant(
  childSpanId: string,
  ancestorSpanId: string,
  spansById: Map<string, BrowserTraceSpan>,
): boolean {
  let current = spansById.get(childSpanId);
  while (current != null && current.parentSpanId != null) {
    if (current.parentSpanId === ancestorSpanId) {
      return true;
    }
    current = spansById.get(current.parentSpanId);
  }
  return false;
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
    await disposeTraceRecorder(page);
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

  test("updates metrics panel after action refresh", async ({ page }) => {
    const beforeTotal = await readMetricCount(page, "todo-total-count");
    const beforeActive = await readMetricCount(page, "todo-active-count");

    await page.getByRole("textbox", { name: "New todo" }).fill("Metrics refresh todo");
    await page.getByRole("textbox", { name: "New todo" }).press("Enter");

    await expect(page.getByText("Metrics refresh todo")).toBeVisible();
    await expect(page.getByTestId("todo-total-count")).toHaveText(String(beforeTotal + 1));
    await expect(page.getByTestId("todo-active-count")).toHaveText(String(beforeActive + 1));
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

  test("captures action-parented rerender tracing with component decode durations", async ({
    page,
  }) => {
    await installTraceRecorder(page);

    const title = `Trace todo ${Date.now()}`;
    await page.getByRole("textbox", { name: "New todo" }).fill(title);
    await page.getByRole("textbox", { name: "New todo" }).press("Enter");
    await expect(page.getByText(title)).toBeVisible();

    const events = await page.evaluate(() => {
      const state = window as unknown as Record<string, unknown>;
      return (state.__rscPrismCapturedTraceEvents ?? []) as BrowserTraceEvent[];
    });
    const spans = buildSpans(events);
    const spansById = new Map(spans.map((span) => [span.spanId, span]));

    const actionSpan = spans.find(
      (span) => spanMatches(span, "rsc.action.call") || spanMatches(span, "rsc.client.callServer"),
    );
    const rerenderSpans = spans.filter((span) => spanMatches(span, "rsc.react.rerender.fetch"));
    const applyBatchSpans = spans.filter((span) => spanMatches(span, "rsc.react.applyBatch"));
    const rerenderOrBatch = [...rerenderSpans, ...applyBatchSpans];
    const decodeSpans = spans.filter((span) => spanMatches(span, "rsc.component.decode"));

    expect(actionSpan).toBeDefined();
    expect(rerenderOrBatch.length).toBeGreaterThan(0);
    expect(
      rerenderOrBatch.some((span) => isDescendant(span.spanId, actionSpan!.spanId, spansById)),
    ).toBe(true);
    expect(decodeSpans.length).toBeGreaterThan(0);
    expect(decodeSpans.every((span) => (span.duration ?? -1) >= 0)).toBe(true);
  });
});
