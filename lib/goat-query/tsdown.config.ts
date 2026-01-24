import pluginBabel from "@rollup/plugin-babel";
import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
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
  entry: ["src/index.ts", "src/react.ts", "src/devtools/index.ts"],
  outDir: "dist",
  format: "esm",
  platform: "neutral",
  clean: true,
  skipNodeModulesBundle: true,
  external: ["react", /^react\//, "@types/react", /^@types\//, /^@lib\//],
  // tsdown's dts bundling currently produces invalid declarations when React 19
  // types are involved (e.g. `undefined<T>` and `(void 0).JSX`), which then breaks
  // downstream typechecks. Generate `.d.ts` via `tsc --emitDeclarationOnly` instead.
  dts: false,
});

export default config;
