import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/react.tsx",
    "src/client-only.ts",
    "src/client.ts",
    "src/client-reference.ts",
    "src/flight-serializer.ts",
    "src/polyfill.ts",
    "src/response.ts",
    "src/server.ts",
    "src/transport.ts",
    "src/types.ts",
    "src/vite.ts",
    "src/runtime/module-registry.ts",
    "src/runtime/webpack-shim.ts",
  ],
  outDir: "dist",
  format: "esm",
  platform: "neutral",
  clean: true,
  unbundle: true,
  skipNodeModulesBundle: true,
  dts: false,
  external: [
    "react",
    "react-server-dom-webpack",
    /^react-server-dom-webpack\/.+$/,
    "@babel/parser",
    "vite",
    "web-streams-polyfill",
    "path",
    "fs/promises",
    /^@lib\//,
  ],
  copy: [
    {
      from: "src/react-server-dom-webpack.d.ts",
      to: "dist",
    },
  ],
});
