import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { rscPrism } from "@lib/rsc-prism/vite";

const rootDir = import.meta.dirname;
const repoRoot = path.resolve(rootDir, "../..");
const rscPrismSourceDir = path.resolve(repoRoot, "lib/rsc-prism/src");

export default defineConfig(() => ({
  root: rootDir,
  publicDir: path.resolve(repoRoot, "public"),
  plugins: [
    tailwindcss(),
    rscPrism({
      workerRuntime: { enabled: true },
      experimental: {
        componentLevelDirectives: true,
        actionBatchRefresh: true,
      },
    }),
    react({ babel: { plugins: ["babel-plugin-react-compiler"] } }),
  ],
  resolve: {
    alias: [
      { find: "@lib/rsc-prism", replacement: rscPrismSourceDir },
      { find: "@", replacement: path.resolve(rootDir, "src") },
      { find: "#", replacement: path.resolve(rootDir, "src/*") },
    ],
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
}));
