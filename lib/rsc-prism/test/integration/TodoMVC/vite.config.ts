import path from "node:path";
import { readFile } from "node:fs/promises";
import { defineConfig, type PluginOption } from "vite";
import { build as viteBuild } from "vite";
import react from "@vitejs/plugin-react";

import { rscPrism } from "../../../src/vite";

const rootDir = import.meta.dirname;
const repoRoot = path.resolve(rootDir, "../../../../../");
const reactServerEntry = path.resolve(repoRoot, "node_modules/react/react.react-server.js");
const reactServerJsxRuntimeEntry = path.resolve(repoRoot, "node_modules/react/jsx-runtime.react-server.js");
const reactServerJsxDevRuntimeEntry = path.resolve(repoRoot, "node_modules/react/jsx-dev-runtime.react-server.js");
const reactDomServerEntry = path.resolve(repoRoot, "node_modules/react-dom/react-dom.react-server.js");
const rscPrismSourceDir = path.resolve(rootDir, "../../../src");
const rscPrismAliases = [
  { find: /^@lib\/rsc-prism$/, replacement: path.resolve(rscPrismSourceDir, "index.ts") },
  { find: /^@lib\/rsc-prism\/(.*)$/, replacement: `${rscPrismSourceDir}/$1` },
] as const;

const swConfig = {
  entry: path.resolve(rootDir, "todo.worker.tsx"),
  outDir: path.resolve(rootDir, ".worker-cache"),
  serveUrl: "/todo.worker.js",
};

async function buildWorker(mode: "development" | "production"): Promise<void> {
  await viteBuild({
    configFile: false,
    mode,
    root: rootDir,
    build: {
      write: true,
      outDir: swConfig.outDir,
      emptyOutDir: true,
      lib: {
        entry: swConfig.entry,
        formats: ["iife"],
        name: "TodoWorker",
        fileName: () => "todo.worker.js",
      },
      rollupOptions: {
        output: {
          intro: [
            "var __webpack_require__ = globalThis.__webpack_require__ || function(id) { return globalThis.__webpack_require__(id); };",
            "var __webpack_chunk_load__ = globalThis.__webpack_chunk_load__ || function(id) { return globalThis.__webpack_chunk_load__(id); };",
            "var __webpack_get_script_filename__ = globalThis.__webpack_get_script_filename__ || function(id) { return globalThis.__webpack_get_script_filename__(id); };",
            "var __webpack_public_path__ = globalThis.__webpack_public_path__ || '/';",
          ].join("\n"),
        },
      },
    },
    resolve: {
      alias: [
        ...rscPrismAliases,
        { find: /^react$/, replacement: reactServerEntry },
        { find: /^react\/jsx-runtime$/, replacement: reactServerJsxRuntimeEntry },
        { find: /^react\/jsx-dev-runtime$/, replacement: reactServerJsxDevRuntimeEntry },
        { find: /^react-dom$/, replacement: reactDomServerEntry },
        { find: "react-server-dom-webpack/server", replacement: "react-server-dom-webpack/server.browser" },
        { find: "react-server-dom-webpack/client", replacement: "react-server-dom-webpack/client.browser" },
      ],
      conditions: [mode, "react-server", "browser", "import", "default"],
    },
    plugins: [
      rscPrism({ mode: "worker" }),
      react() as unknown as PluginOption,
    ],
    define: { "process.env.NODE_ENV": JSON.stringify(mode) },
  });
}

export default defineConfig(({ mode }) => ({
  root: rootDir,
  optimizeDeps: {
    include: ["react-server-dom-webpack/server.browser", "react-server-dom-webpack/client.browser"],
  },
  resolve: {
    alias: [
      ...rscPrismAliases,
    ],
  },
  plugins: [
    rscPrism({ mode: "main" }),
    react({ babel: { plugins: ["babel-plugin-react-compiler"] } }) as unknown as PluginOption,
    {
      name: "todo-worker-builder",
      async buildStart() {
        await buildWorker(mode as "development" | "production");
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === swConfig.serveUrl) {
            try {
              const content = await readFile(path.resolve(swConfig.outDir, "todo.worker.js"), "utf-8");
              res.setHeader("Content-Type", "application/javascript");
              res.setHeader("Cache-Control", "no-cache");
              res.end(content);
              return;
            } catch {
              // continue to fallback if worker not built yet
            }
          }
          next();
        });
      },
      async handleHotUpdate({ file, server }) {
        if (!file.includes(".worker-cache") && file.includes("TodoMVC")) {
          await buildWorker(mode as "development" | "production");
          server.ws.send({ type: "full-reload" });
        }
      },
    },
  ],
}));
