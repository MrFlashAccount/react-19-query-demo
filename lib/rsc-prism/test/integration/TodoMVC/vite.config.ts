import path from "node:path";
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

import { rscPrism } from "../../../src/vite";

const rootDir = import.meta.dirname;
const rscPrismSourceDir = path.resolve(rootDir, "../../../src");
const rscPrismAliases = [
  { find: /^@lib\/rsc-prism$/, replacement: path.resolve(rscPrismSourceDir, "index.ts") },
  { find: /^@lib\/rsc-prism\/react$/, replacement: path.resolve(rscPrismSourceDir, "react.tsx") },
  { find: /^@lib\/rsc-prism\/(.*)$/, replacement: `${rscPrismSourceDir}/$1` },
] as const;

export default defineConfig(() => ({
  root: rootDir,
  resolve: { alias: [...rscPrismAliases] },
  plugins: [
    rscPrism({
      workerRuntime: {
        enabled: true,
        servePath: "/todo.worker.js",
        outDir: ".vite/todo-worker-cache",
      },
    }),
    react({ babel: { plugins: ["babel-plugin-react-compiler"] } }) as unknown as PluginOption,
  ],
}));
