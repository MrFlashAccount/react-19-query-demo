import pluginBabel from "@rollup/plugin-babel";
import { defineConfig } from "tsdown";

export default defineConfig({
  plugins: [
    pluginBabel({
      babelHelpers: "bundled",
      parserOpts: {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
      },
      plugins: ["babel-plugin-react-compiler"],
      extensions: [".js", ".jsx", ".ts", ".tsx"],
    }),
  ],
  entry: ["index.ts", "react.ts", "devtools/index.ts"],
  outDir: "dist",
  format: "esm",
  platform: "neutral",
  sourcemap: true,
  clean: true,
  inlineOnly: false,
  skipNodeModulesBundle: true,
  dts: {
    resolver: "tsc",
  },
  external: ["react", /^react\//, "@types/react", /^@types\//, /^@lib\//],
});

