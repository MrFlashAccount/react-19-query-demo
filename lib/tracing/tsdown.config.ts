import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/node.ts", "src/async-context.ts"],
  outDir: "dist",
  format: "esm",
  platform: "browser",
  clean: true,
  skipNodeModulesBundle: false,
  dts: false,
  noExternal: ["lit-html", "@lib/brand"],
});
