/// <reference lib="webworker" />

const STRESS_DEPTH = 5;
const STRESS_BREADTH = 5;
const STRESS_BRANCHES = 1;
const STRESS_TASKS = 25;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function runBranchUntraced(depth: number, breadth: number): Promise<void> {
  await sleep(2 + Math.random() * 10);

  if (depth <= 0) {
    return;
  }

  const tasks = Array.from({ length: breadth }, () => runBranchUntraced(depth - 1, breadth));
  await Promise.all(tasks);
  await sleep(2 + Math.random() * 10);
}

async function runStressTestUntraced(): Promise<number> {
  const startTime = performance.now();

  await sleep(5 + Math.random() * 15);

  for (let i = 0; i < STRESS_TASKS; i += 1) {
    const branches = Array.from({ length: STRESS_BRANCHES }, () =>
      runBranchUntraced(STRESS_DEPTH, STRESS_BREADTH),
    );
    await Promise.all(branches);
    await sleep(5 + Math.random() * 15);
  }

  for (let i = 0; i < 5; i += 1) {
    await sleep(4 + i + Math.random() * 6);
  }

  return performance.now() - startTime;
}

type StressTestWorkerMessage =
  | { type: "runStressTest"; id: string }
  | { type: "cancel"; id: string };

type StressTestWorkerResponse =
  | { type: "progress"; id: string; phase: string; current: number; total: number }
  | { type: "complete"; id: string; untracedMs: number; tracedMs: number }
  | { type: "error"; id: string; error: string };

let currentId: string | null = null;
let isCancelled = false;

async function runTracingStressTest(
  sendProgress: (phase: string, current: number, total: number) => Promise<void>,
): Promise<number> {
  const startTime = performance.now();

  await sleep(5 + Math.random() * 15);

  for (let i = 0; i < STRESS_TASKS; i += 1) {
    if (isCancelled) return performance.now() - startTime;

    const branches = Array.from({ length: STRESS_BRANCHES }, (_, index) =>
      runBranchTraced(`root-${index}`, sendProgress),
    );
    await Promise.all(branches);
    await sleep(5 + Math.random() * 15);
  }

  for (let i = 0; i < 5; i += 1) {
    if (isCancelled) return performance.now() - startTime;
    await sleep(4 + i + Math.random() * 6);
  }

  return performance.now() - startTime;
}

async function runBranchTraced(
  path: string,
  sendProgress: (phase: string, current: number, total: number) => Promise<void>,
): Promise<void> {
  await sleep(2 + Math.random() * 10);

  const depth = parseInt(path.split(".").pop() || "0", 10);
  if (depth <= 0) {
    return;
  }

  const tasks = Array.from({ length: STRESS_BREADTH }, (_, index) =>
    runBranchTraced(`${path}.${index}`, sendProgress),
  );
  await Promise.all(tasks);
  await sleep(2 + Math.random() * 10);
}

self.addEventListener("message", async (event: MessageEvent<StressTestWorkerMessage>) => {
  const { id, type } = event.data;

  if (type === "cancel") {
    isCancelled = true;
    return;
  }

  currentId = id;
  isCancelled = false;

  try {
    const untracedDuration = await runStressTestUntraced();

    const tracedDuration = await runTracingStressTest(async (phase, current, total) => {
      self.postMessage({
        type: "progress",
        id,
        phase,
        current,
        total,
      });
    });

    const response: StressTestWorkerResponse = {
      type: "complete",
      id,
      untracedMs: untracedDuration,
      tracedMs: tracedDuration,
    };

    self.postMessage(response);
  } catch (error) {
    const errorResponse: StressTestWorkerResponse = {
      type: "error",
      id,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(errorResponse);
  } finally {
    currentId = null;
  }
});
