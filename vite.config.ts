import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [
          "babel-plugin-react-compiler",
          [
            "./lib/tracing/babel-plugin/explicit-parent",
            {
              tracingModule: "@lib/tracing/helpers",
              tracedFn: "traced",
              exclude: /node_modules|\.test\.|\.spec\.|\/lib\/tracing\//,
              minStatements: 2,
            },
          ],
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "lib/react": path.resolve(__dirname, "lib/react"),
      "lib/devtools": path.resolve(__dirname, "lib/devtools/index.ts"),
      "@lib/tracing": path.resolve(__dirname, "lib/tracing"),
    },
  },
  worker: { format: "es" },
  build: {
    sourcemap: true,
    rolldownOptions: {
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
});
