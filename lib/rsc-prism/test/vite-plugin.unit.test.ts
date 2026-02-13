import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ResolvedConfig } from "vite";

import { rscPrism } from "../src/vite";

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
    const plugin = rscPrism({ mode: "worker" });
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
    const transformedCode = transformed != null && typeof transformed === "object" ? transformed.code : null;

    expect(transformedCode).toContain('Symbol.for("react.client.reference")');
    expect(transformedCode).toContain('__rscPrismModuleId = "src/client-components.tsx"');
    expect(transformedCode).toContain('"src/client-components.tsx#Counter"');
    expect(transformedCode).toContain('"src/client-components.tsx#Button"');
    expect(transformedCode).toContain('"src/client-components.tsx#default"');
  });

  it("transforms use client modules in worker mode", async () => {
    const plugin = rscPrism({ mode: "worker" });
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/client-components.tsx`;
    const source = `
"use client";
export function Counter() { return null; }
`;

    const transformed = await callHook(plugin.transform, undefined, source, id);
    const transformedCode = transformed != null && typeof transformed === "object" ? transformed.code : null;

    expect(transformedCode).toContain('"src/client-components.tsx#Counter"');
  });

  it("does not transform use worker modules in worker mode", async () => {
    const plugin = rscPrism({ mode: "worker" });
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
    const plugin = rscPrism({ mode: "main" });
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/worker-view.tsx`;
    const source = `
"use worker";
export default function WorkerView() { return null; }
export function WorkerPanel() { return null; }
`;

    const transformed = await callHook(plugin.transform, undefined, source, id);
    const transformedCode = transformed != null && typeof transformed === "object" ? transformed.code : null;

    expect(transformedCode).toContain('Symbol.for("rsc.worker.reference")');
    expect(transformedCode).toContain('__rscPrismCreateWorkerRef("default")');
    expect(transformedCode).toContain('__rscPrismCreateWorkerRef("WorkerPanel")');
  });

  it("transforms modules when use directive is no longer a Babel directive", async () => {
    const plugin = rscPrism({ mode: "worker" });
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/client-components.tsx`;
    const source = `
import "/@vite/client";
"use main";
export function Counter() { return null; }
`;

    const transformed = await callHook(plugin.transform, undefined, source, id);
    const transformedCode = transformed != null && typeof transformed === "object" ? transformed.code : null;

    expect(transformedCode).toContain('Symbol.for("react.client.reference")');
    expect(transformedCode).toContain('"src/client-components.tsx#Counter"');
  });

  it("leaves non-directive modules unchanged in worker mode", async () => {
    const plugin = rscPrism({ mode: "worker" });
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/no-directive.ts`;
    const source = `export const value = 1;`;

    const transformed = await callHook(plugin.transform, undefined, source, id);
    expect(transformed).toBeNull();
  });

  it("throws on export star in worker mode", async () => {
    const plugin = rscPrism({ mode: "worker" });
    const root = "/virtual/project";
    callHook(plugin.configResolved, undefined, createResolvedConfig(root));

    const id = `${root}/src/client-components.ts`;
    const source = `
"use main";
export * from "./other";
`;

    expect(() => callHook(plugin.transform, undefined, source, id)).toThrow('Unsupported "export *"');
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

    const plugin = rscPrism({ mode: "main" });
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

    expect(loadedCode).toContain('import { registerClientModule } from "@lib/rsc-prism/runtime/module-registry"');
    expect(loadedCode).toContain("src/client-a.tsx");
    expect(loadedCode).not.toContain("src/non-client.tsx");
  });

  it("auto-injects main virtual module into html", () => {
    const plugin = rscPrism({ mode: "main" });
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
            src: "/@id/virtual:rsc-prism/main-thread-modules",
          },
          injectTo: "head-prepend",
        },
      ],
    });
  });

  it("does not auto-inject when html already imports the virtual module", () => {
    const plugin = rscPrism({ mode: "main" });
    const transformed = callHook(
      plugin.transformIndexHtml as any,
      undefined,
      `<!doctype html><html><head><script type="module" src="virtual:rsc-prism/main-thread-modules"></script></head><body></body></html>`,
    );

    expect(transformed).toBeUndefined();
  });

  it("injects react-server resolve config in worker environment", async () => {
    const plugin = rscPrism({ mode: "worker" });
    const configured = await callHook(
      plugin.configEnvironment as any,
      undefined,
      "worker",
      {},
      { command: "build", mode: "development" },
    );
    const resolveConfig = configured != null && typeof configured === "object" ? configured.resolve : undefined;

    expect(resolveConfig).toBeDefined();
    expect(resolveConfig?.conditions).toContain("react-server");
    expect(resolveConfig?.conditions).toContain("development");
    expect(resolveConfig?.conditions).toContain("browser");
    expect(resolveConfig?.alias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ find: "react-server-dom-webpack/server" }),
        expect.objectContaining({ find: "react-server-dom-webpack/client" }),
      ]),
    );
    expect(configured?.optimizeDeps?.exclude).toEqual(
      expect.arrayContaining([
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-server-dom-webpack/server.browser",
        "react-server-dom-webpack/client.browser",
      ]),
    );
  });

  it("does not inject react-server resolve config in main mode", async () => {
    const plugin = rscPrism({ mode: "main" });
    const configured = await callHook(
      plugin.configEnvironment as any,
      undefined,
      "client",
      {},
      { command: "build", mode: "development" },
    );
    expect(configured).toBeDefined();
    expect(configured?.resolve).toBeUndefined();
    expect(configured?.optimizeDeps?.exclude).toContain("react-server-dom-webpack/server.browser");
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

    const plugin = rscPrism({ mode: "worker" });
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

    expect(loadedCode).toContain('Symbol.for("react.client.reference")');
    expect(loadedCode).toContain("$$id");
    expect(loadedCode).toContain('"src/client-components.tsx#TodoComposer"');
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

    const plugin = rscPrism({ mode: "worker" });
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
    await writeFile(importerPath, `import WorkerDefault, { WorkerView } from "./worker-view";`, "utf8");

    const plugin = rscPrism({ mode: "main" });
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

    expect(loadedCode).toContain("Symbol.for(\"rsc.worker.reference\")");
    expect(loadedCode).toContain('__rscPrismCreateWorkerRef("default")');
    expect(loadedCode).toContain('__rscPrismCreateWorkerRef("WorkerView")');
    expect(loadedCode).toContain("export { __rscPrismWorkerReferenceMap };");
  });

  it("redirects root-relative main imports of use worker modules", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "rsc-prism-vite-main-worker-root-relative-test-"));
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

    const plugin = rscPrism({ mode: "main" });
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

});
