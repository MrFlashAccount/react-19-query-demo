import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/http.ts",
    "src/response.ts",
    "src/router.ts",
    "src/types.ts",
    "src/worker.ts",
  ],
  outDir: "dist",
  format: "esm",
  platform: "neutral",
  clean: true,
  unbundle: true,
  skipNodeModulesBundle: true,
  dts: false,
  external: [/^@lib\//],
});
