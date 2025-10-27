import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({ babel: { plugins: ["babel-plugin-react-compiler"] } }),
  ],
  build: {
    outDir: "lib",
    copyPublicDir: false,
    lib: {
      entry: "./src/components/LocalTanStackQueryTab/index.tsx",
      name: "LocalTanStackQueryTab",
      fileName: () => "local-tanstack-query.js",
      formats: ["es"],
    },
    minify: false,
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "./src/components/shared"],
      output: {
        esModule: true,
        format: "esm",
      },
    },
  },
});
