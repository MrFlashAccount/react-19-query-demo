import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({ babel: { plugins: ["babel-plugin-react-compiler"] } }),
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        chunkFileNames: "[name].js",
        manualChunks: {
          shared: ["./src/components/shared/index.ts"],
          "local-tanstack-query": [
            "./src/components/LocalTanStackQueryTab",
            "@tanstack/react-query-local",
          ],
          "tanstack-query": [
            "./src/components/TanStackQueryTab",
            "@tanstack/react-query",
          ],
          "custom-library": [
            "./src/components/CustomLibraryTab",
            "./src/lib/index.ts",
          ],
        },
      },
    },
  },
});
