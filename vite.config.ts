import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({ babel: { plugins: ["babel-plugin-react-compiler"] } }),
  ],
  resolve: {
    alias: {
      "lib/react": path.resolve(__dirname, "lib/react"),
      "lib/devtools": path.resolve(__dirname, "lib/devtools"),
    },
  },
  worker: {
    format: "es",
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          "react-query": ["@tanstack/react-query"],
          lib: ["lib"],
        },
      },
    },
  },
});
