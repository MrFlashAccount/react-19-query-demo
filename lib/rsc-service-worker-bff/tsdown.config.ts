import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "index.ts",
    "http.ts",
    "response.ts",
    "router.ts",
    "types.ts",
    "worker.ts",
    "rsc/index.ts",
    "rsc/client-only.ts",
    "rsc/client-reference.ts",
    "rsc/client.ts",
    "rsc/flight-serializer.ts",
    "rsc/http.ts",
    "rsc/module-registry.ts",
    "rsc/polyfill.ts",
    "rsc/response.ts",
    "rsc/server.ts",
    "rsc/types.ts",
    "rsc/webpack-shim.ts",
  ],
  outDir: "dist",
  format: "esm",
  platform: "neutral",
  sourcemap: true,
  clean: true,
  unbundle: true,
  external: [
    "react",
    "react-is",
    "react-server-dom-webpack",
    /^react-server-dom-webpack\/.+$/,
    "web-streams-polyfill",
    /^@lib\//,
  ],
  copy: [
    {
      from: "rsc/react-server-dom-webpack.d.ts",
      to: "dist/rsc",
    },
  ],
});

