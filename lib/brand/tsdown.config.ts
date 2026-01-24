import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/brand.ts"],
  outDir: "dist",
  format: "esm",
  platform: "neutral",
  sourcemap: true,
  clean: true,
  skipNodeModulesBundle: true,
  dts: false,
});
