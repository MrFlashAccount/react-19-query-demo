import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["index.ts"],
  outDir: "dist",
  format: "esm",
  platform: "browser",
  sourcemap: true,
  clean: true,
  external: ["lit-html", "lit-html/directives/ref.js"],
});

