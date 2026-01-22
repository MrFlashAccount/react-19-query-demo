import path from "path";

import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      "lib/performance-monitor": path.resolve(__dirname, "../index.ts"),
    },
  },
  server: {
    port: 5174,
    open: true,
  },
  build: {
    outDir: path.resolve(__dirname, "../../../dist/perf-test"),
    emptyOutDir: true,
  },
});
