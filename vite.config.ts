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
    entry: path.resolve(rootDir, "src/components/RSCMoviesTab/sw.tsx"),
    outDir: path.resolve(rootDir, "src/components/RSCMoviesTab/.sw-cache"),
    serveUrls: ["/movies-sw.js"],
    watchPattern: "RSCMoviesTab",
  },
];

// Build a single service worker
async function buildSW(config: (typeof serviceWorkers)[0]): Promise<void> {
  console.log(`[SW:${config.name}] Building...`);

  await viteBuild({
    configFile: false,
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
      minify: false,
      sourcemap: "inline",
    },
    resolve: {
      alias: {
        "lib/rsc-service-worker-bff": path.resolve(rootDir, "lib/rsc-service-worker-bff"),
      },
    },
    plugins: [react()],
    logLevel: "warn",
    define: {
      "process.env.NODE_ENV": JSON.stringify("development"),
    },
  });

  console.log(`[SW:${config.name}] Built successfully`);
}

// Build all service workers
async function buildAllServiceWorkers(): Promise<void> {
  await Promise.all(serviceWorkers.map(buildSW));
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
    // RSC Service Workers plugin
    {
      name: "rsc-service-workers",
      async buildStart() {
        await buildAllServiceWorkers();
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
            await buildSW(sw);
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
      "lib/goat-query/react": path.resolve(rootDir, "lib/goat-query/react.ts"),
      "lib/goat-query/devtools": path.resolve(rootDir, "lib/goat-query/devtools/index.ts"),
      "lib/brand": path.resolve(rootDir, "lib/brand/brand.ts"),
      "lib/tracing/helpers": path.resolve(rootDir, "lib/tracing/helpers.ts"),
      "lib/tracing": path.resolve(rootDir, "lib/tracing"),
      "lib/performance-monitor": path.resolve(rootDir, "lib/performance-monitor/index.ts"),
      "lib/rsc-service-worker-bff": path.resolve(rootDir, "lib/rsc-service-worker-bff"),
    },
  },
  worker: { format: "es" },
  build: {
    sourcemap: false,
    rolldownOptions: {
      input: {
        main: path.resolve(rootDir, "index.html"),
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
});
