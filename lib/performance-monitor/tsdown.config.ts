import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: "esm",
  platform: "browser",
  clean: true,
  // Bundle node_modules (including lit-html) into dist.
  skipNodeModulesBundle: false,
  dts: false,
  noExternal: ["lit-html"],
});
