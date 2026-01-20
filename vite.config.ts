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
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
  ],
  resolve: {
    alias: {
      "lib/react": path.resolve(__dirname, "lib/react"),
      "lib/devtools": path.resolve(__dirname, "lib/devtools/index.ts"),
      "lib/brand": path.resolve(__dirname, "lib/brand/brand.ts"),
      "lib/tracing/helpers": path.resolve(__dirname, "lib/tracing/helpers.ts"),
      "lib/tracing": path.resolve(__dirname, "lib/tracing"),
    },
  },
  worker: { format: "es" },
  build: {
    sourcemap: false,
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
  server: {
    // Required for SAB to work in the browser
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
