import { defineConfig, build as viteBuild } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const rootDir = resolve(__dirname);
const swCacheDir = resolve(rootDir, ".sw-cache");

// Build the service worker
async function buildServiceWorker(): Promise<void> {
  console.log("[SW] Building service worker...");
  
  await viteBuild({
    configFile: false,
    root: rootDir,
    build: {
      write: true,
      outDir: swCacheDir,
      emptyOutDir: true,
      lib: {
        entry: resolve(rootDir, "sw.ts"),
        formats: ["iife"],
        name: "ServiceWorker",
        fileName: () => "sw.js",
      },
      minify: false,
      sourcemap: "inline",
    },
    resolve: {
      alias: {
        "@lib/rsc-service-worker-bff": resolve(rootDir, ".."),
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

export default defineConfig({
  plugins: [
    react(),
    {
      name: "service-worker-dev",
      async buildStart() {
        // Build SW at startup
        if (!existsSync(resolve(swCacheDir, "sw.js"))) {
          await buildServiceWorker();
        }
      },
      configureServer(server) {
        // Serve compiled SW
        server.middlewares.use(async (req, res, next) => {
          if (req.url === "/sw.js") {
            try {
              const content = await readFile(resolve(swCacheDir, "sw.js"), "utf-8");
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
        // Rebuild SW when files change
        if (
          file.includes("rsc-service-worker-bff") &&
          !file.includes(".sw-cache") &&
          !file.includes("node_modules")
        ) {
          console.log("[SW] Detected change, rebuilding...");
          await buildServiceWorker();
          // Notify clients to reload
          server.ws.send({ type: "full-reload" });
        }
      },
    },
  ],
  root: rootDir,
  resolve: {
    alias: {
      "@lib/rsc-service-worker-bff": resolve(rootDir, ".."),
    },
  },
  build: {
    outDir: resolve(rootDir, "dist"),
  },
  server: {
    port: 5199,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client"],
    exclude: ["react-server-dom-webpack/server"],
  },
});
