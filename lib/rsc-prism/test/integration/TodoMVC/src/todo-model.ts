import type { TodoFilter, TodoRecord } from "./types";

interface TodoState extends TodoRecord {
  createdAt: number;
}

const TODO_DB_NAME = "rsc-prism-todomvc";
const TODO_DB_VERSION = 1;
const TODO_STORE_NAME = "todos";
const TODO_CREATED_AT_INDEX = "byCreatedAt";

const SEED_TODO_TITLES = [
  "Read worker transport docs",
  "Ship TodoMVC scenario",
  "Verify RSC refresh cycle",
  "Verify RSC action cycle",
  "Review pull request feedback from design team",
  "Draft release notes for the next milestone",
  "Prepare demo script for product walkthrough",
  "Update onboarding checklist for new hires",
  "Refine caching strategy for API responses",
  "Schedule one-on-one with project mentor",
  "Audit analytics events on checkout page",
  "Fix flaky integration test in CI",
  "Write migration plan for legacy endpoints",
  "Sync roadmap priorities with leadership",
  "Document incident response playbook",
  "Clean up stale feature flags in config",
  "Research alternatives for image optimization",
  "Reply to vendor renewal questionnaire",
  "Create quarterly goals draft",
  "Review accessibility report findings",
  "Prepare handoff notes for support team",
  "Add retry handling for payment webhooks",
  "Confirm launch checklist with operations",
  "Consolidate duplicate bug tickets",
  "Validate telemetry in staging environment",
  "Set up alerts for background worker failures",
  "Refactor auth middleware for clarity",
  "Verify GDPR data export workflow",
  "Backfill missing unit tests for utils",
  "Update API contract examples",
  "Call landlord about lease extension",
  "Book annual dentist appointment",
  "Plan meals for next week",
  "Buy groceries for weekend dinner",
  "Drop off package at shipping store",
  "Pay electricity bill",
  "Renew car registration",
  "Refill prescription at pharmacy",
  "Schedule oil change for car",
  "Clean out garage shelves",
  "Sort photos from summer trip",
  "Back up laptop to external drive",
  "Organize tax receipts folder",
  "Cancel unused streaming subscription",
  "Research hiking trail for Saturday",
  "Invite friends to game night",
  "Practice interview questions",
  "Update resume with latest project",
  "Apply to three engineering roles",
  "Read chapter on distributed systems",
  "Watch React conference recordings",
  "Complete TypeScript kata exercises",
  "Review notes from architecture meeting",
  "Prepare sprint planning agenda",
  "Estimate stories for next iteration",
  "Triage incoming support requests",
  "Close outdated project board cards",
  "Pair on bug reproduction with QA",
  "Run dependency vulnerability scan",
  "Update changelog for patch release",
  "Rotate API keys in staging",
  "Test disaster recovery procedure",
  "Create dashboard for conversion funnel",
  "Analyze churn trends by segment",
  "Draft customer interview questions",
  "Follow up with beta testers",
  "Summarize weekly metrics for team",
  "Prepare agenda for retrospective",
  "Review contract redlines with legal",
  "Confirm budget allocation for Q3",
  "Review SaaS invoices for duplicates",
  "Set up recurring backups",
  "Benchmark cold-start latency",
  "Investigate memory spike in worker pool",
  "Write runbook for deployment rollback",
  "Verify feature gate behavior in prod",
  "Add synthetic monitoring for login flow",
  "Tune database index for search query",
  "Create checklist for release candidate",
  "Coordinate translation updates with locale team",
  "Update help center screenshots",
  "Record short demo for sales enablement",
  "Draft announcement post for community forum",
  "Review open source license obligations",
  "Prepare workshop slides for interns",
  "Set goals for personal learning plan",
  "Practice keyboard shortcuts for editor",
  "Declutter downloads folder",
  "Repair bike tire",
  "Book hotel for conference trip",
  "Plan birthday dinner reservation",
  "Buy gift for niece",
  "Replace hallway light bulb",
  "Water indoor plants",
  "Clean coffee machine",
  "Review monthly budget spreadsheet",
  "Finish reading saved articles",
  "Plan weekend family visit",
  "Organize workspace desk drawers",
  "Update emergency contacts list",
] as const;

const COMPLETED_SEED_INDICES = new Set([2, 8, 13, 21, 28, 34, 40, 46, 52, 59, 65, 72, 79, 87, 94]);

let dbPromise: Promise<IDBDatabase | null> | null = null;
let todosCache: TodoState[] | null = null;
let loadTodosPromise: Promise<TodoState[]> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();
let shouldUseInMemoryFallback = false;

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

function openTodoDatabase(): Promise<IDBDatabase | null> {
  if (shouldUseInMemoryFallback) {
    return Promise.resolve(null);
  }

  if (dbPromise != null) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    const openRequest = indexedDB.open(TODO_DB_NAME, TODO_DB_VERSION);

    openRequest.onupgradeneeded = () => {
      const database = openRequest.result;
      const store = database.objectStoreNames.contains(TODO_STORE_NAME)
        ? openRequest.transaction?.objectStore(TODO_STORE_NAME)
        : database.createObjectStore(TODO_STORE_NAME, { keyPath: "id" });

      if (store != null && !store.indexNames.contains(TODO_CREATED_AT_INDEX)) {
        store.createIndex(TODO_CREATED_AT_INDEX, "createdAt");
      }
    };

    openRequest.onsuccess = () => {
      resolve(openRequest.result);
    };

    openRequest.onerror = () => {
      reject(openRequest.error ?? new Error("Failed to open todo IndexedDB database."));
    };
  });

  return dbPromise.catch(() => {
    shouldUseInMemoryFallback = true;
    dbPromise = null;
    return null;
  });
}

function buildSeedTodos(): TodoState[] {
  const baseCreatedAt = Date.now() + SEED_TODO_TITLES.length;

  return SEED_TODO_TITLES.map((title, index) => ({
    id: `seed-todo-${index + 1}`,
    title,
    completed: COMPLETED_SEED_INDICES.has(index),
    createdAt: baseCreatedAt - index,
  }));
}

async function ensureSeedTodos(database: IDBDatabase): Promise<void> {
  const readTransaction = database.transaction(TODO_STORE_NAME, "readonly");
  const readStore = readTransaction.objectStore(TODO_STORE_NAME);
  const existingCount = await requestToPromise(readStore.count());
  await waitForTransaction(readTransaction);

  if (existingCount > 0) {
    return;
  }

  const seedTodos = buildSeedTodos();
  const writeTransaction = database.transaction(TODO_STORE_NAME, "readwrite");
  const writeStore = writeTransaction.objectStore(TODO_STORE_NAME);

  for (const todo of seedTodos) {
    writeStore.put(todo);
  }

  await waitForTransaction(writeTransaction);
}

async function readTodosFromDatabase(database: IDBDatabase): Promise<TodoState[]> {
  const transaction = database.transaction(TODO_STORE_NAME, "readonly");
  const store = transaction.objectStore(TODO_STORE_NAME);
  const byCreatedAt = store.index(TODO_CREATED_AT_INDEX);
  const todos: TodoState[] = [];

  await new Promise<void>((resolve, reject) => {
    const cursorRequest = byCreatedAt.openCursor(null, "prev");

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor == null) {
        resolve();
        return;
      }

      todos.push(cursor.value as TodoState);
      cursor.continue();
    };

    cursorRequest.onerror = () => {
      reject(cursorRequest.error ?? new Error("Failed to read todos from IndexedDB."));
    };
  });

  await waitForTransaction(transaction);
  return todos;
}

async function loadTodos(): Promise<TodoState[]> {
  if (todosCache != null) {
    return todosCache;
  }

  if (loadTodosPromise != null) {
    return loadTodosPromise;
  }

  loadTodosPromise = (async () => {
    const database = await openTodoDatabase();
    if (database == null) {
      const seedTodos = buildSeedTodos();
      todosCache = seedTodos;
      return seedTodos;
    }

    await ensureSeedTodos(database);
    const todos = await readTodosFromDatabase(database);
    todosCache = todos;
    return todos;
  })();

  try {
    return await loadTodosPromise;
  } finally {
    loadTodosPromise = null;
  }
}

async function persistTodos(todos: TodoState[]): Promise<void> {
  const database = await openTodoDatabase();
  if (database != null) {
    const transaction = database.transaction(TODO_STORE_NAME, "readwrite");
    const store = transaction.objectStore(TODO_STORE_NAME);
    store.clear();

    for (const todo of todos) {
      store.put(todo);
    }

    await waitForTransaction(transaction);
  }
  todosCache = todos;
}

function getVisibleTodos(todos: TodoState[], filter: TodoFilter): TodoState[] {
  switch (filter) {
    case "active":
      return todos.filter((todo) => !todo.completed);
    case "completed":
      return todos.filter((todo) => todo.completed);
    default:
      return todos;
  }
}

function getCounts(todos: TodoState[]) {
  const totalCount = todos.length;
  const completedCount = todos.reduce((count, todo) => count + (todo.completed ? 1 : 0), 0);
  const activeCount = totalCount - completedCount;
  return { totalCount, activeCount, completedCount };
}

async function updateTodos(mutator: (todos: TodoState[]) => TodoState[]): Promise<TodoState[]> {
  const update = mutationQueue.then(async () => {
    const todos = await loadTodos();
    const nextTodos = mutator(todos);

    if (nextTodos !== todos) {
      await persistTodos(nextTodos);
    }

    return nextTodos;
  });

  mutationQueue = update.then(
    () => undefined,
    () => undefined,
  );

  return update;
}

export interface TodoWorkerViewData {
  filter: TodoFilter;
  visibleTodos: TodoRecord[];
  totalCount: number;
  activeCount: number;
  completedCount: number;
  allCompleted: boolean;
}

export function parseFilter(value: string | null): TodoFilter {
  if (value === "active" || value === "completed") {
    return value;
  }
  return "all";
}

export async function buildTodoWorkerViewData(filter: TodoFilter): Promise<TodoWorkerViewData> {
  const todos = await loadTodos();
  const visibleTodos = getVisibleTodos(todos, filter);
  const { totalCount, activeCount, completedCount } = getCounts(todos);
  const allCompleted = totalCount > 0 && activeCount === 0;
  return {
    filter,
    visibleTodos,
    totalCount,
    activeCount,
    completedCount,
    allCompleted,
  };
}

export async function readMutationResult() {
  const todos = await loadTodos();
  return {
    ok: true,
    ...getCounts(todos),
  };
}

export async function addTodoItem(title: string): Promise<TodoState[]> {
  const nextTitle = normalizeTitle(title);
  if (nextTitle.length === 0) {
    return loadTodos();
  }

  return updateTodos((todos) => {
    const nextCreatedAt = Math.max(Date.now(), (todos[0]?.createdAt ?? 0) + 1);
    return [
      {
        id: crypto.randomUUID(),
        title: nextTitle,
        completed: false,
        createdAt: nextCreatedAt,
      },
      ...todos,
    ];
  });
}

export async function toggleTodoItem(id: string): Promise<TodoState[]> {
  return updateTodos((todos) =>
    todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)),
  );
}

export async function renameTodoItem(id: string, title: string): Promise<TodoState[]> {
  const nextTitle = normalizeTitle(title);

  if (nextTitle.length === 0) {
    return deleteTodoItem(id);
  }

  return updateTodos((todos) =>
    todos.map((todo) => (todo.id === id ? { ...todo, title: nextTitle } : todo)),
  );
}

export async function deleteTodoItem(id: string): Promise<TodoState[]> {
  return updateTodos((todos) => todos.filter((todo) => todo.id !== id));
}

export async function clearCompletedTodos(): Promise<TodoState[]> {
  return updateTodos((todos) => todos.filter((todo) => !todo.completed));
}

export async function toggleAllTodos(): Promise<TodoState[]> {
  return updateTodos((todos) => {
    const shouldComplete = todos.some((todo) => !todo.completed);
    return todos.map((todo) => ({ ...todo, completed: shouldComplete }));
  });
}
