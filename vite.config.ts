import path from "path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
  ],
  resolve: {
    alias: {
      "lib/goat-query/react": path.resolve(__dirname, "lib/goat-query/react.ts"),
      "lib/goat-query/devtools": path.resolve(__dirname, "lib/goat-query/devtools/index.ts"),
      "lib/brand": path.resolve(__dirname, "lib/brand/brand.ts"),
      "lib/tracing/helpers": path.resolve(__dirname, "lib/tracing/helpers.ts"),
      "lib/tracing": path.resolve(__dirname, "lib/tracing"),
      "lib/performance-monitor": path.resolve(__dirname, "lib/performance-monitor/index.ts"),
    },
  },
  worker: { format: "es" },
  build: {
    sourcemap: false,
    rolldownOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        "perf-monitor": path.resolve(__dirname, "lib/performance-monitor/test/index.html"),
        "rsc-playground": path.resolve(__dirname, "lib/rsc-service-worker-bff/test/index.html"),
      },
      output: {
        advancedChunks: {
          groups: [
            { name: "react", test: /node_modules\/react/ },
            { name: "react-dom", test: /node_modules\/react-dom/ },
          ],
        },
      },
    },
  },
  server: {
    // Required for SAB to work in the browser
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
