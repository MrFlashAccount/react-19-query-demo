import path from "path";
import fs from "fs";
import { readFile } from "fs/promises";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, build as viteBuild } from "vite";

const rootDir = __dirname;

// Service worker configs
const serviceWorkers = [
  {
    name: "rsc-playground",
    entry: path.resolve(rootDir, "lib/rsc-service-worker-bff/test/sw.tsx"),
    outDir: path.resolve(rootDir, "lib/rsc-service-worker-bff/test/.sw-cache"),
    serveUrls: ["/sw.js", "/lib/rsc-service-worker-bff/test/sw.js"],
    watchPattern: "rsc-service-worker-bff",
  },
  {
    // Combined Movies SW: handles both JSON API (/api/movies/*) and RSC (/rsc/movies)
    name: "movies",
    entry: path.resolve(rootDir, "examples/movies-db/src/components/RSCMoviesTab/sw.tsx"),
    outDir: path.resolve(rootDir, "examples/movies-db/src/components/RSCMoviesTab/.sw-cache"),
    serveUrls: ["/movies-sw.js"],
    watchPattern: "RSCMoviesTab",
  },
];

// Build a single service worker
async function buildSW(
  config: (typeof serviceWorkers)[0],
  mode: "development" | "production",
): Promise<void> {
  console.group(`[SW:${config.name}, ${mode}]`);
  console.log("Building...");

  await viteBuild({
    configFile: false,
    mode: mode,
    root: path.dirname(config.entry),
    build: {
      write: true,
      outDir: config.outDir,
      emptyOutDir: true,
      lib: {
        entry: config.entry,
        formats: ["iife"],
        name: "ServiceWorker",
        fileName: () => "sw.js",
      },
    },
    resolve: {
      alias: {
        "@lib/rsc-service-worker-bff": path.resolve(rootDir, "lib/rsc-service-worker-bff/src"),
      },
      // Required for react-server-dom-webpack/server
      conditions: [mode, "browser", "import", "default"],
    },
    plugins: [react()],
    define: { "process.env.NODE_ENV": JSON.stringify(mode) },
  });

  console.log("Built successfully");
  console.groupEnd();
}

// Build all service workers
async function buildAllServiceWorkers(mode: "development" | "production"): Promise<void> {
  await Promise.all(serviceWorkers.map((sw) => buildSW(sw, mode)));
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    // RSC Service Workers plugin
    {
      name: "rsc-service-workers",
      async buildStart() {
        await buildAllServiceWorkers(mode as "development" | "production");
      },
      configureServer(server) {
        // Serve compiled service workers
        server.middlewares.use(async (req, res, next) => {
          for (const sw of serviceWorkers) {
            if (sw.serveUrls.some((url) => req.url === url)) {
              try {
                const content = await readFile(path.resolve(sw.outDir, "sw.js"), "utf-8");
                res.setHeader("Content-Type", "application/javascript");
                res.setHeader("Cache-Control", "no-cache");
                res.end(content);
                return;
              } catch (err) {
                console.error(`[SW:${sw.name}] Error serving:`, err);
              }
            }
          }
          next();
        });
      },
      async handleHotUpdate({ file, server }) {
        // Rebuild relevant SW when files change
        for (const sw of serviceWorkers) {
          if (
            file.includes(sw.watchPattern) &&
            !file.includes(".sw-cache") &&
            !file.includes("node_modules")
          ) {
            console.log(`[SW:${sw.name}] Detected change, rebuilding...`);
            await buildSW(sw, mode as "development" | "production");
            server.ws.send({ type: "full-reload" });
            return;
          }
        }
      },
      // Copy SWs to output for production build
      async writeBundle() {
        const distDir = path.resolve(rootDir, "dist");

        for (const sw of serviceWorkers) {
          const swSource = path.resolve(sw.outDir, "sw.js");
          if (fs.existsSync(swSource)) {
            for (const url of sw.serveUrls) {
              const dest = path.resolve(distDir, url.slice(1)); // Remove leading /
              fs.mkdirSync(path.dirname(dest), { recursive: true });
              fs.copyFileSync(swSource, dest);
            }
            console.log(`[SW:${sw.name}] Copied to dist`);
          }
        }
      },
    },
  ],
  resolve: {
    alias: {
      // monitoring-dashboard path aliases (so it can be built from repo root)
      "@": path.resolve(rootDir, "examples/monitoring-dashboard/src"),
      "#": path.resolve(rootDir, "examples/monitoring-dashboard/src"),
      "@db": path.resolve(rootDir, "examples/monitoring-dashboard/src/db"),
      "@api": path.resolve(rootDir, "examples/monitoring-dashboard/src/api"),
      "@components": path.resolve(rootDir, "examples/monitoring-dashboard/src/components"),
      "@queries": path.resolve(rootDir, "examples/monitoring-dashboard/src/queries"),
      "@hooks": path.resolve(rootDir, "examples/monitoring-dashboard/src/hooks"),

      "@lib/goat-query/react": path.resolve(rootDir, "lib/goat-query/src/react.ts"),
      "@lib/goat-query/devtools": path.resolve(rootDir, "lib/goat-query/src/devtools/index.ts"),
      "@lib/brand": path.resolve(rootDir, "lib/brand/src/brand.ts"),
      "@lib/tracing/helpers": path.resolve(rootDir, "lib/tracing/src/helpers.ts"),
      "@lib/tracing": path.resolve(rootDir, "lib/tracing"),
      "@lib/performance-monitor": path.resolve(rootDir, "lib/performance-monitor/src/index.ts"),
      "@lib/rsc-service-worker-bff": path.resolve(rootDir, "lib/rsc-service-worker-bff/src"),
    },
  },
  worker: { format: "es" },
  build: {
    sourcemap: false,
    rolldownOptions: {
      input: {
        main: path.resolve(rootDir, "index.html"),
        "movies-db": path.resolve(rootDir, "movies-db/index.html"),
        "monitoring-dashboard": path.resolve(rootDir, "monitoring-dashboard/index.html"),
        "perf-monitor": path.resolve(rootDir, "lib/performance-monitor/test/index.html"),
        "rsc-playground": path.resolve(rootDir, "lib/rsc-service-worker-bff/test/index.html"),
      },
      output: {
        advancedChunks: {
          groups: [
            { name: "react", test: /node_modules\/react/ },
            { name: "react-dom", test: /node_modules\/react-dom/ },
          ],
        },
      },
    },
  },
  server: {
    // Required for SAB to work in the browser
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
}));
