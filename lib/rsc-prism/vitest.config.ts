import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(rootDir, "../..");
const reactServerEntry = resolve(repoRoot, "node_modules/react/react.react-server.js");
const reactServerJsxRuntimeEntry = resolve(repoRoot, "node_modules/react/jsx-runtime.react-server.js");
const reactServerJsxDevRuntimeEntry = resolve(
  repoRoot,
  "node_modules/react/jsx-dev-runtime.react-server.js",
);
const reactDomServerEntry = resolve(repoRoot, "node_modules/react-dom/react-dom.react-server.js");

export default defineConfig(({ mode }) => ({
  resolve: {
    conditions: [
      mode === "production" ? "production" : "development",
      "react-server",
      "browser",
      "import",
      "default",
    ],
    alias: [
      { find: /^react$/, replacement: reactServerEntry },
      { find: /^react\/jsx-runtime$/, replacement: reactServerJsxRuntimeEntry },
      { find: /^react\/jsx-dev-runtime$/, replacement: reactServerJsxDevRuntimeEntry },
      { find: /^react-dom$/, replacement: reactDomServerEntry },
    ],
  },
  optimizeDeps: {
    include: ["web-streams-polyfill"],
    exclude: [
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom",
    ],
  },
  test: {
    deps: {
      optimizer: {
        client: {
          enabled: false,
        },
        ssr: {
          enabled: false,
        },
      },
    },
    server: {
      deps: {
        inline: [/^react$/, /^react-dom$/],
      },
    },
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["test/**/*.unit.test.{ts,tsx}"],
        },
      },
      {
        test: {
          name: "browser",
          include: ["test/**/*.browser.test.{ts,tsx}"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            screenshotFailures: false,
            instances: [{ browser: "chromium" }, { browser: "webkit" }],
          },
        },
      },
    ],
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.unit.test.{ts,tsx}",
        "src/**/*.browser.test.{ts,tsx}",
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
}));
