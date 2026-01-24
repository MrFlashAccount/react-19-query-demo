import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const rootDir = import.meta.dirname;
const libDir = path.resolve(rootDir, "../../lib");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
      "@db": path.resolve(rootDir, "src/db"),
      "@api": path.resolve(rootDir, "src/api"),
      "@components": path.resolve(rootDir, "src/components"),
      "@queries": path.resolve(rootDir, "src/queries"),
      "@hooks": path.resolve(rootDir, "src/hooks"),
      "@lib/goat-query/react": path.resolve(libDir, "goat-query/react.ts"),
      "@lib/goat-query": path.resolve(libDir, "goat-query/index.ts"),
      "@lib/rsc-service-worker-bff": path.resolve(libDir, "rsc-service-worker-bff/index.ts"),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
});

