import path from "path";
import fs from "fs";
import { readFile } from "fs/promises";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, build as viteBuild } from "vite";

const rscTestDir = path.resolve(__dirname, "lib/rsc-service-worker-bff/test");
const swCacheDir = path.resolve(rscTestDir, ".sw-cache");

// Build the RSC service worker
async function buildServiceWorker(): Promise<void> {
  console.log("[SW] Building RSC service worker...");

  await viteBuild({
    configFile: false,
    root: rscTestDir,
    build: {
      write: true,
      outDir: swCacheDir,
      emptyOutDir: true,
      lib: {
        entry: path.resolve(rscTestDir, "sw.ts"),
        formats: ["iife"],
        name: "ServiceWorker",
        fileName: () => "sw.js",
      },
      minify: false,
      sourcemap: "inline",
    },
    resolve: {
      alias: {
        "@lib/rsc-service-worker-bff": path.resolve(rscTestDir, ".."),
      },
    },
    plugins: [react()],
    logLevel: "warn",
    define: {
      "process.env.NODE_ENV": JSON.stringify("development"),
    },
  });

  console.log("[SW] Service worker built successfully");
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    // RSC Service Worker plugin
    {
      name: "rsc-service-worker-dev",
      async buildStart() {
        // Always build SW at startup to ensure it's fresh
        await buildServiceWorker();
      },
      configureServer(server) {
        // Serve compiled SW for RSC playground
        server.middlewares.use(async (req, res, next) => {
          if (req.url === "/lib/rsc-service-worker-bff/test/sw.js" || req.url === "/sw.js") {
            try {
              const content = await readFile(path.resolve(swCacheDir, "sw.js"), "utf-8");
              res.setHeader("Content-Type", "application/javascript");
              res.setHeader("Cache-Control", "no-cache");
              res.end(content);
              return;
            } catch (err) {
              console.error("[SW] Error serving sw.js:", err);
            }
          }
          next();
        });
      },
      async handleHotUpdate({ file, server }) {
        // Rebuild SW when RSC files change
        if (
          file.includes("rsc-service-worker-bff") &&
          !file.includes(".sw-cache") &&
          !file.includes("node_modules")
        ) {
          console.log("[SW] Detected change, rebuilding...");
          await buildServiceWorker();
          server.ws.send({ type: "full-reload" });
        }
      },
      // Copy SW to output for production build
      async writeBundle() {
        const distDir = path.resolve(__dirname, "dist");
        const swSource = path.resolve(swCacheDir, "sw.js");
        const swDest = path.resolve(distDir, "sw.js");
        const swDestRsc = path.resolve(distDir, "lib/rsc-service-worker-bff/test/sw.js");

        if (fs.existsSync(swSource)) {
          // Copy to root for /sw.js
          fs.copyFileSync(swSource, swDest);
          // Copy to test dir for relative path
          fs.mkdirSync(path.dirname(swDestRsc), { recursive: true });
          fs.copyFileSync(swSource, swDestRsc);
          console.log("[SW] Copied service worker to dist");
        }
      },
    },
  ],
  resolve: {
    alias: {
      "lib/goat-query/react": path.resolve(__dirname, "lib/goat-query/react.ts"),
      "lib/goat-query/devtools": path.resolve(__dirname, "lib/goat-query/devtools/index.ts"),
      "lib/brand": path.resolve(__dirname, "lib/brand/brand.ts"),
      "lib/tracing/helpers": path.resolve(__dirname, "lib/tracing/helpers.ts"),
      "lib/tracing": path.resolve(__dirname, "lib/tracing"),
      "lib/performance-monitor": path.resolve(__dirname, "lib/performance-monitor/index.ts"),
    },
  },
  worker: { format: "es" },
  build: {
    sourcemap: false,
    rolldownOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        "perf-monitor": path.resolve(__dirname, "lib/performance-monitor/test/index.html"),
        "rsc-playground": path.resolve(__dirname, "lib/rsc-service-worker-bff/test/index.html"),
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
});
