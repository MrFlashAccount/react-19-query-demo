import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ResolvedConfig } from "vite";

import { rscPrism, rscPrismWorker } from "../src/vite";

function createResolvedConfig(root: string): ResolvedConfig {
  return { root } as ResolvedConfig;
}

type PluginHook<T extends (...args: any[]) => any> =
  | T
  | {
      handler: T;
    };

function callHook<T extends (...args: any[]) => any>(
  hook: PluginHook<T> | undefined,
  thisArg: unknown,
  ...args: Parameters<T>
): ReturnType<T> | undefined {
  if (hook == null) {
    return undefined;
  }

  if (typeof hook === "function") {
    return hook.apply(thisArg, args);
  }

  return hook.handler.apply(thisArg, args);
}

describe("rscPrism vite plugin", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop();
      if (root == null) {
        break;
      }
      await rm(root, { recursive: true, force: true });
    }
  });

  it("transforms use main modules in worker mode", async () => {
    const plugin = rscPrismWorker();
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/client-components.tsx`;
    const source = `
"use main";
export default function Root() { return null; }
export function Counter() { return null; }
export const Button = () => null;
`;

    const transformed = await callHook(plugin.transform, undefined, source, id);
    const transformedCode =
      transformed != null && typeof transformed === "object" ? transformed.code : null;

    expect(transformedCode).toContain("@lib/rsc-prism/module-references/create-client-ref");
    expect(transformedCode).toContain("createClientRef");
    expect(transformedCode).toContain('"/src/client-components.tsx#Counter"');
    expect(transformedCode).toContain('"/src/client-components.tsx#Button"');
    expect(transformedCode).toContain('"/src/client-components.tsx#default"');
  });

  it("transforms use client modules in worker mode", async () => {
    const plugin = rscPrismWorker();
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/client-components.tsx`;
    const source = `
"use client";
export function Counter() { return null; }
`;

    const transformed = await callHook(plugin.transform, undefined, source, id);
    const transformedCode =
      transformed != null && typeof transformed === "object" ? transformed.code : null;

    expect(transformedCode).toContain('"/src/client-components.tsx#Counter"');
  });

  it("does not transform use worker modules in worker mode", async () => {
    const plugin = rscPrismWorker();
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/worker-view.tsx`;
    const source = `
"use worker";
export function WorkerView() { return null; }
`;

    const transformed = await callHook(plugin.transform, undefined, source, id);
    expect(transformed).toBeNull();
  });

  it("transforms use worker modules in main mode", async () => {
    const plugin = rscPrism();
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/worker-view.tsx`;
    const source = `
"use worker";
export default function WorkerView() { return null; }
export function WorkerPanel() { return null; }
`;

    const transformed = await callHook(plugin.transform, undefined, source, id);
    const transformedCode =
      transformed != null && typeof transformed === "object" ? transformed.code : null;

    expect(transformedCode).toContain("@lib/rsc-prism/module-references/create-worker-ref");
    expect(transformedCode).toContain('createWorkerRef(__rscPrismModuleId + "#default"');
    expect(transformedCode).toContain('createWorkerRef(__rscPrismModuleId + "#WorkerPanel"');
  });

  it("transforms modules when use directive is no longer a Babel directive", async () => {
    const plugin = rscPrismWorker();
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/client-components.tsx`;
    const source = `
import "/@vite/client";
"use main";
export function Counter() { return null; }
`;

    const transformed = await callHook(plugin.transform, undefined, source, id);
    const transformedCode =
      transformed != null && typeof transformed === "object" ? transformed.code : null;

    expect(transformedCode).toContain("@lib/rsc-prism/module-references/create-client-ref");
    expect(transformedCode).toContain('"/src/client-components.tsx#Counter"');
  });

  it("leaves non-directive modules unchanged in worker mode", async () => {
    const plugin = rscPrismWorker();
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/no-directive.ts`;
    const source = `export const value = 1;`;

    const transformed = await callHook(plugin.transform, undefined, source, id);
    expect(transformed).toBeNull();
  });

  it("short-circuits non-directive modules before export analysis", async () => {
    const plugin = rscPrismWorker();
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/non-directive.ts`;
    const source = `export * from "./other";`;

    const transformed = await callHook(plugin.transform, undefined, source, id);
    expect(transformed).toBeNull();
  });

  it("throws on export star in worker mode", async () => {
    const plugin = rscPrismWorker();
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/client-components.ts`;
    const source = `
"use main";
export * from "./other";
`;

    await expect(callHook(plugin.transform, undefined, source, id)).rejects.toThrow(
      'Unsupported "export *"',
    );
  });

  it("generates main virtual module with registration imports", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "rsc-prism-vite-test-"));
    tempRoots.push(root);

    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(
      path.join(root, "src", "client-a.tsx"),
      `
"use main";
export function A() { return null; }
`,
      "utf8",
    );
    await writeFile(path.join(root, "src", "non-client.tsx"), `export const value = 1;`, "utf8");

    const plugin = rscPrism();
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const resolved = await callHook(
      plugin.resolveId as any,
      undefined,
      "virtual:rsc-prism/main-thread-modules",
      undefined,
      undefined,
    );
    expect(resolved).toBe("\0rsc-prism:main-thread-modules");

    const loaded = await callHook(plugin.load, undefined, "\0rsc-prism:main-thread-modules");
    const loadedCode = typeof loaded === "string" ? loaded : loaded?.code;

    expect(loadedCode).not.toContain("@lib/rsc-prism/runtime/module-registry");
    expect(loadedCode).toContain("src/client-a.tsx");
    expect(loadedCode).not.toContain("src/non-client.tsx");
    expect(loadedCode).toContain("__RSC_PRISM_CLIENT_MANIFEST__");
    expect(loadedCode).toContain('"/src/client-a.tsx#A"');
    expect(loadedCode).toContain('name: "A"');
    expect(loadedCode).toContain('"/src/client-a.tsx#*"');
  });

  it("includes worker bootstrap import in main virtual module when runtime is enabled", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "rsc-prism-vite-main-bootstrap-test-"));
    tempRoots.push(root);
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(
      path.join(root, "src", "client-a.tsx"),
      '"use main"; export const A = 1;',
      "utf8",
    );

    const plugin = rscPrism({
      workerRuntime: {
        enabled: true,
      },
    });
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const loaded = await callHook(plugin.load, undefined, "\0rsc-prism:main-thread-modules");
    const loadedCode = typeof loaded === "string" ? loaded : loaded?.code;

    expect(loadedCode).toContain('import "virtual:rsc-prism/worker-bootstrap";');
  });

  it("omits worker bootstrap import in main virtual module when runtime is disabled", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "rsc-prism-vite-main-no-bootstrap-test-"));
    tempRoots.push(root);
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(
      path.join(root, "src", "client-a.tsx"),
      '"use main"; export const A = 1;',
      "utf8",
    );

    const plugin = rscPrism({
      workerRuntime: {
        enabled: false,
      },
    });
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const loaded = await callHook(plugin.load, undefined, "\0rsc-prism:main-thread-modules");
    const loadedCode = typeof loaded === "string" ? loaded : loaded?.code;

    expect(loadedCode).not.toContain('import "virtual:rsc-prism/worker-bootstrap";');
  });

  it("auto-injects main virtual module into html", () => {
    const plugin = rscPrism();
    const transformed = callHook(
      plugin.transformIndexHtml as any,
      undefined,
      "<!doctype html><html><head></head><body><div id='root'></div></body></html>",
    );

    expect(transformed).toMatchObject({
      tags: [
        {
          tag: "script",
          attrs: {
            type: "module",
            src: "virtual:rsc-prism/main-thread-modules",
          },
          injectTo: "head-prepend",
        },
      ],
    });
  });

  it("does not auto-inject when html already imports the virtual module", () => {
    const plugin = rscPrism();
    const transformed = callHook(
      plugin.transformIndexHtml as any,
      undefined,
      `<!doctype html><html><head><script type="module" src="virtual:rsc-prism/main-thread-modules"></script></head><body></body></html>`,
    );

    expect(transformed).toBeUndefined();
  });

  it("injects worker bootstrap before main virtual module when runtime is enabled", () => {
    const plugin = rscPrism({
      workerRuntime: {
        enabled: true,
      },
    });
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const transformed = callHook(
      plugin.transformIndexHtml as any,
      undefined,
      "<!doctype html><html><head></head><body><div id='root'></div></body></html>",
    );

    const tags = (transformed as { tags?: Array<{ attrs?: { src?: string } }> } | undefined)?.tags;
    expect(tags?.[0]?.attrs?.src).toBe("virtual:rsc-prism/worker-bootstrap");
    expect(tags?.[1]?.attrs?.src).toBe("virtual:rsc-prism/main-thread-modules");
  });

  it("resolves and loads worker bootstrap virtual module when runtime is enabled", async () => {
    const plugin = rscPrism({
      workerRuntime: {
        enabled: true,
      },
    });
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const resolved = await callHook(
      plugin.resolveId as any,
      undefined,
      "virtual:rsc-prism/worker-bootstrap",
      undefined,
      undefined,
    );
    expect(resolved).toBe("\0rsc-prism:worker-bootstrap");

    const loaded = await callHook(plugin.load, undefined, "\0rsc-prism:worker-bootstrap");
    const loadedCode = typeof loaded === "string" ? loaded : loaded?.code;
    expect(loadedCode).toContain("export async function bootstrapWorkerRuntime()");
    expect(loadedCode).toContain('new Worker("/assets/rsc-prism-worker-runtime');
    expect(loadedCode).toContain(
      'import { createWorkerRowTransport } from "@lib/rsc-prism/transport";',
    );
    expect(loadedCode).toContain("createWorkerRowTransport");
    expect(loadedCode).toContain("experimentalActionBatchRefresh: false");
    expect(loadedCode).toContain("dispose()");
    expect(loadedCode).toContain("let __rscPrismBootstrappedRuntime = null;");
    expect(loadedCode).toContain("let __rscPrismBootstrapPromise = null;");
    expect(loadedCode).toContain("if (__rscPrismBootstrappedRuntime != null)");
    expect(loadedCode).toContain(
      "globalThis[__RSC_PRISM_BOOTSTRAP_GLOBAL_KEY] = bootstrapWorkerRuntime;",
    );
  });

  it("wires experimental action batch refresh into worker bootstrap runtime", async () => {
    const plugin = rscPrism({
      workerRuntime: {
        enabled: true,
      },
      experimental: {
        actionBatchRefresh: true,
      },
    });
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const loaded = await callHook(plugin.load, undefined, "\0rsc-prism:worker-bootstrap");
    const loadedCode = typeof loaded === "string" ? loaded : loaded?.code;
    expect(loadedCode).toContain("experimentalActionBatchRefresh: true");
  });

  it("does not bypass worker-ready handshake with fallback timer", async () => {
    const plugin = rscPrism({
      workerRuntime: {
        enabled: true,
      },
    });
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const loaded = await callHook(plugin.load, undefined, "\0rsc-prism:worker-bootstrap");
    const loadedCode = typeof loaded === "string" ? loaded : loaded?.code;
    expect(loadedCode).not.toContain("fallbackReady");
    expect(loadedCode).toContain('event.data.type === "rsc.prism.worker.ready"');
  });

  it("throws when workerRuntime.entry is provided", () => {
    expect(() =>
      rscPrism({
        workerRuntime: {
          enabled: true,
          entry: "todo.worker.tsx",
        } as any,
      }),
    ).toThrow("workerRuntime.entry has been removed");
  });

  it("throws when workerRuntime.servePath is provided", () => {
    expect(() =>
      rscPrism({
        workerRuntime: {
          enabled: true,
          servePath: "/todo.worker.js",
        } as any,
      }),
    ).toThrow("workerRuntime.servePath is now internal");
  });

  it("throws when workerRuntime.fileName is provided", () => {
    expect(() =>
      rscPrism({
        workerRuntime: {
          enabled: true,
          fileName: "todo.worker.js",
        } as any,
      }),
    ).toThrow("workerRuntime.fileName is now internal");
  });

  it("skips worker runtime rebuild for irrelevant hot updates", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "rsc-prism-vite-worker-hmr-ignore-test-"));
    tempRoots.push(root);
    await mkdir(path.join(root, "src"), { recursive: true });

    const plugin = rscPrism({
      workerRuntime: {
        enabled: true,
      },
    });
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const send = vi.fn();
    await callHook(plugin.handleHotUpdate as any, undefined, {
      file: path.join(root, "README.md"),
      server: { ws: { send } },
    });

    expect(send).not.toHaveBeenCalled();
  });

  it("skips worker runtime rebuild for non-worker source module updates", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "rsc-prism-vite-worker-hmr-non-worker-test-"),
    );
    tempRoots.push(root);
    await mkdir(path.join(root, "src"), { recursive: true });
    const nonWorkerFile = path.join(root, "src", "plain.ts");
    await writeFile(nonWorkerFile, "export const value = 1;", "utf8");

    const plugin = rscPrism({
      workerRuntime: {
        enabled: true,
      },
    });
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const send = vi.fn();
    await callHook(plugin.handleHotUpdate as any, undefined, {
      file: nonWorkerFile,
      server: { ws: { send } },
    });

    expect(send).not.toHaveBeenCalled();
  });

  it("injects react-server resolve config in worker environment", async () => {
    const plugin = rscPrismWorker();
    const configured = await callHook(
      plugin.configEnvironment as any,
      undefined,
      "worker",
      {},
      { command: "build", mode: "development" },
    );
    const resolveConfig =
      configured != null && typeof configured === "object" ? configured.resolve : undefined;

    expect(resolveConfig).toBeDefined();
    expect(resolveConfig?.conditions).toContain("react-server");
    expect(resolveConfig?.conditions).toContain("development");
    expect(resolveConfig?.conditions).toContain("browser");
    expect(resolveConfig?.alias).toEqual([]);
    expect(configured?.optimizeDeps?.exclude).toEqual(
      expect.arrayContaining(["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom"]),
    );
  });

  it("does not inject react-server resolve config in main mode", async () => {
    const plugin = rscPrism();
    const configured = await callHook(
      plugin.configEnvironment as any,
      undefined,
      "client",
      {},
      { command: "build", mode: "development" },
    );
    expect(configured).toBeDefined();
    expect(configured?.resolve).toBeUndefined();
    expect(configured?.optimizeDeps?.exclude).toEqual([]);
  });

  it("redirects worker imports of use main modules to proxy virtual modules", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "rsc-prism-vite-worker-proxy-test-"));
    tempRoots.push(root);
    await mkdir(path.join(root, "src"), { recursive: true });
    const clientModulePath = path.join(root, "src", "client-components.tsx");
    const importerPath = path.join(root, "src", "todo.worker.tsx");

    await writeFile(
      clientModulePath,
      `
"use main";
export function TodoComposer() { return null; }
`,
      "utf8",
    );
    await writeFile(importerPath, `import { TodoComposer } from "./client-components";`, "utf8");

    const plugin = rscPrismWorker();
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const resolveContext = {
      resolve: async () => ({ id: clientModulePath }),
    };

    const resolved = await callHook(
      plugin.resolveId as any,
      resolveContext,
      "./client-components",
      importerPath,
      undefined,
    );
    expect(typeof resolved).toBe("string");
    expect((resolved as string)!.startsWith("\0rsc-prism:worker-proxy:")).toBe(true);

    const loaded = await callHook(plugin.load, undefined, resolved as string);
    const loadedCode = typeof loaded === "string" ? loaded : loaded?.code;

    expect(loadedCode).toContain("@lib/rsc-prism/module-references/create-client-ref");
    expect(loadedCode).toContain('createClientRef("/src/client-components.tsx#TodoComposer")');
  });

  it("does not redirect worker imports of use worker modules", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "rsc-prism-vite-worker-use-worker-test-"));
    tempRoots.push(root);
    await mkdir(path.join(root, "src"), { recursive: true });
    const workerModulePath = path.join(root, "src", "worker-view.tsx");
    const importerPath = path.join(root, "src", "todo.worker.tsx");

    await writeFile(
      workerModulePath,
      `
"use worker";
export function WorkerView() { return null; }
`,
      "utf8",
    );
    await writeFile(importerPath, `import { WorkerView } from "./worker-view";`, "utf8");

    const plugin = rscPrismWorker();
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const resolveContext = {
      resolve: async () => ({ id: workerModulePath }),
    };

    const resolved = await callHook(
      plugin.resolveId as any,
      resolveContext,
      "./worker-view",
      importerPath,
      undefined,
    );
    expect(resolved).toBeNull();
  });

  it("redirects main imports of use worker modules to worker references", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "rsc-prism-vite-main-worker-ref-test-"));
    tempRoots.push(root);
    await mkdir(path.join(root, "src"), { recursive: true });
    const workerModulePath = path.join(root, "src", "worker-view.tsx");
    const importerPath = path.join(root, "src", "main.tsx");

    await writeFile(
      workerModulePath,
      `
"use worker";
export default function WorkerDefault() { return null; }
export function WorkerView() { return null; }
`,
      "utf8",
    );
    await writeFile(
      importerPath,
      `import WorkerDefault, { WorkerView } from "./worker-view";`,
      "utf8",
    );

    const plugin = rscPrism();
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const resolveContext = {
      resolve: async () => ({ id: workerModulePath }),
    };

    const resolved = await callHook(
      plugin.resolveId as any,
      resolveContext,
      "./worker-view",
      importerPath,
      undefined,
    );
    expect(typeof resolved).toBe("string");
    expect((resolved as string)!.startsWith("\0rsc-prism:main-worker-ref:")).toBe(true);

    const loaded = await callHook(plugin.load, undefined, resolved as string);
    const loadedCode = typeof loaded === "string" ? loaded : loaded?.code;

    expect(loadedCode).toContain("@lib/rsc-prism/module-references/create-worker-ref");
    expect(loadedCode).toContain('createWorkerRef(__rscPrismModuleId + "#default"');
    expect(loadedCode).toContain('createWorkerRef(__rscPrismModuleId + "#WorkerView"');
    expect(loadedCode).toContain("export { __rscPrismWorkerReferenceMap };");
  });

  it("redirects root-relative main imports of use worker modules", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "rsc-prism-vite-main-worker-root-relative-test-"),
    );
    tempRoots.push(root);
    await mkdir(path.join(root, "src"), { recursive: true });
    const workerModulePath = path.join(root, "src", "worker-view.tsx");
    const importerPath = path.join(root, "src", "main.tsx");

    await writeFile(
      workerModulePath,
      `
"use worker";
export function WorkerView() { return null; }
`,
      "utf8",
    );
    await writeFile(importerPath, `import { WorkerView } from "/src/worker-view.tsx";`, "utf8");

    const plugin = rscPrism();
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const resolveContext = {
      resolve: async () => ({ id: "/src/worker-view.tsx" }),
    };

    const resolved = await callHook(
      plugin.resolveId as any,
      resolveContext,
      "/src/worker-view.tsx",
      importerPath,
      undefined,
    );
    expect(typeof resolved).toBe("string");
    expect((resolved as string)!.startsWith("\0rsc-prism:main-worker-ref:")).toBe(true);
  });

  it("redirects main imports of function-level use worker actions", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "rsc-prism-vite-main-worker-action-ref-test-"),
    );
    tempRoots.push(root);
    await mkdir(path.join(root, "src"), { recursive: true });
    const actionModulePath = path.join(root, "src", "todo-actions.ts");
    const importerPath = path.join(root, "src", "main.tsx");

    await writeFile(
      actionModulePath,
      `
export function addTodo() {
  "use worker";
  return "ok";
}
`,
      "utf8",
    );
    await writeFile(importerPath, `import { addTodo } from "./todo-actions";`, "utf8");

    const plugin = rscPrism();
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const resolveContext = {
      resolve: async () => ({ id: actionModulePath }),
    };

    const resolved = await callHook(
      plugin.resolveId as any,
      resolveContext,
      "./todo-actions",
      importerPath,
      undefined,
    );
    expect(typeof resolved).toBe("string");
    expect((resolved as string)!.startsWith("\0rsc-prism:main-worker-action-ref:")).toBe(true);

    const loaded = await callHook(plugin.load, undefined, resolved as string);
    const loadedCode = typeof loaded === "string" ? loaded : loaded?.code;
    expect(loadedCode).toContain("@lib/rsc-prism/module-references/create-action-ref");
    expect(loadedCode).toContain('createActionRef(__rscPrismActionIdMap["addTodo"]');
  });

  it("requires use worker to be first statement inside exported functions", async () => {
    const plugin = rscPrism();
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/todo-actions.ts`;
    const source = `
export function addTodo() {
  const first = 1;
  "use worker";
  return first;
}
`;

    const transformed = await callHook(plugin.transform, undefined, source, id);
    expect(transformed).toBeNull();
  });

  it("throws when action modules export non-action values", async () => {
    const plugin = rscPrism();
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/todo-actions.ts`;
    const source = `
export function addTodo() {
  "use worker";
  return "ok";
}
export const metadata = { feature: true };
`;

    await expect(callHook(plugin.transform, undefined, source, id)).rejects.toThrow(
      "must only export actions",
    );
  });

  it("supports mixed component/action worker directives behind experimental flag", async () => {
    const plugin = rscPrism({
      experimental: {
        componentLevelDirectives: true,
      },
    });
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/worker-directives.tsx`;
    const source = `
export function WorkerPanel() {
  "use worker";
  return null;
}
export async function addTodo() {
  "use worker";
  return "ok";
}
export const metadata = { stable: true };
`;

    const transformed = await callHook(plugin.transform, undefined, source, id);
    const transformedCode =
      transformed != null && typeof transformed === "object" ? transformed.code : null;

    expect(transformedCode).toContain("@lib/rsc-prism/module-references/create-worker-ref");
    expect(transformedCode).toContain("@lib/rsc-prism/module-references/create-action-ref");
    expect(transformedCode).toContain('createWorkerRef(__rscPrismModuleId + "#WorkerPanel"');
    expect(transformedCode).toContain('createActionRef(__rscPrismActionIdMap["addTodo"]');
    expect(transformedCode).toContain("metadata");
    expect(transformedCode).toContain("rsc-prism-original");
  });

  it("adds synthetic exports for local main components referenced by local worker components", async () => {
    const plugin = rscPrism({
      experimental: {
        componentLevelDirectives: true,
      },
    });
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/main.tsx`;
    const source = `
import { rsc } from "@lib/rsc-prism/react";

const TodoViewRSC = rsc(async function TodoViewRSC() {
  "use worker";
  return <TodoItemRow />;
});

function TodoItemRow() {
  return null;
}
`;

    const transformed = await callHook(plugin.transform, undefined, source, id);
    const transformedCode =
      transformed != null && typeof transformed === "object" ? transformed.code : null;

    expect(transformedCode).toContain('createWorkerRef("/src/main.tsx#@local:TodoViewRSC"');
    expect(transformedCode).toContain(
      "export { TodoItemRow as __rscPrismLocalClient_TodoItemRow };",
    );
  });

  it("resolves mixed worker directives to dedicated virtual module when experimental flag is enabled", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "rsc-prism-vite-main-worker-directive-ref-test-"),
    );
    tempRoots.push(root);
    await mkdir(path.join(root, "src"), { recursive: true });
    const directiveModulePath = path.join(root, "src", "worker-directives.tsx");
    const importerPath = path.join(root, "src", "main.tsx");

    await writeFile(
      directiveModulePath,
      `
export function WorkerPanel() {
  "use worker";
  return null;
}
export function addTodo() {
  "use worker";
  return "ok";
}
export const metadata = { stable: true };
`,
      "utf8",
    );
    await writeFile(
      importerPath,
      `import { WorkerPanel, addTodo } from "./worker-directives";`,
      "utf8",
    );

    const plugin = rscPrism({
      experimental: {
        componentLevelDirectives: true,
      },
    });
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const resolveContext = {
      resolve: async () => ({ id: directiveModulePath }),
    };

    const resolved = await callHook(
      plugin.resolveId as any,
      resolveContext,
      "./worker-directives",
      importerPath,
      undefined,
    );
    expect(typeof resolved).toBe("string");
    expect((resolved as string)!.startsWith("\0rsc-prism:main-worker-directive-ref:")).toBe(true);

    const loaded = await callHook(plugin.load, undefined, resolved as string);
    const loadedCode = typeof loaded === "string" ? loaded : loaded?.code;
    expect(loadedCode).toContain('createWorkerRef(__rscPrismModuleId + "#WorkerPanel"');
    expect(loadedCode).toContain('createActionRef(__rscPrismActionIdMap["addTodo"]');
    expect(loadedCode).toContain("metadata");
    expect(loadedCode).toContain("rsc-prism-original");
  });
});
