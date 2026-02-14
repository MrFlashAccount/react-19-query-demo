import path from "node:path";
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

import { rscPrism, rscPrismWorkerBuilder } from "../../../src/vite";

const rootDir = import.meta.dirname;
const rscPrismSourceDir = path.resolve(rootDir, "../../../src");
const rscPrismAliases = [
  { find: /^@lib\/rsc-prism$/, replacement: path.resolve(rscPrismSourceDir, "index.ts") },
  { find: /^@lib\/rsc-prism\/(.*)$/, replacement: `${rscPrismSourceDir}/$1` },
] as const;

export default defineConfig(() => ({
  root: rootDir,
  optimizeDeps: {
    include: ["react-server-dom-webpack/server.browser", "react-server-dom-webpack/client.browser"],
  },
  resolve: { alias: [...rscPrismAliases] },
  plugins: [
    rscPrism({ mode: "main" }),
    react({ babel: { plugins: ["babel-plugin-react-compiler"] } }) as unknown as PluginOption,
    rscPrismWorkerBuilder({
      entry: "todo.worker.tsx",
      serveUrl: "/todo.worker.js",
      outDir: ".vite/todo-worker-cache",
      watchInclude: "TodoMVC",
    }),
  ],
}));
