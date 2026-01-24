import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["brand.ts", "types.ts", "standard-schema.ts"],
  outDir: "dist",
  format: "esm",
  platform: "neutral",
  sourcemap: true,
  clean: true,
});

