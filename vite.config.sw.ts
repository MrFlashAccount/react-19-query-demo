import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "./public",
    sourcemap: true,
    emptyOutDir: false,
    lib: {
      entry: "./src/api/movieApi.service-worker.ts",
      formats: ["iife"],
      name: "movieApi.service-worker",
      fileName: () => "movieApi.service-worker.js",
    },
  },
});
