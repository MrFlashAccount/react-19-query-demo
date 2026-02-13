import path from "node:path";
import fs from "node:fs";
import { readFile } from "node:fs/promises";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, build as viteBuild } from "vite";
import { rscPrism } from "@lib/rsc-prism/vite";

const rootDir = import.meta.dirname;
const repoRoot = path.resolve(rootDir, "../..");
const libDir = path.resolve(repoRoot, "lib");
const reactServerEntry = path.resolve(repoRoot, "node_modules/react/react.react-server.js");
const reactDomServerEntry = path.resolve(repoRoot, "node_modules/react-dom/react-dom.react-server.js");

// Service worker config (movies RSC + JSON API)
const swConfig = {
  name: "movies",
  entry: path.resolve(rootDir, "src/components/RSCMoviesTab/sw.tsx"),
  outDir: path.resolve(rootDir, "src/components/RSCMoviesTab/.sw-cache"),
  serveUrl: "/movies-sw.js",
  watchPattern: "RSCMoviesTab",
};

async function buildSW(mode: "development" | "production"): Promise<void> {
  console.group(`[SW:${swConfig.name}, ${mode}]`);
  console.log("Building...");

  await viteBuild({
    configFile: false,
    mode,
    root: rootDir,
    build: {
      write: true,
      outDir: swConfig.outDir,
      emptyOutDir: true,
      lib: {
        entry: swConfig.entry,
        formats: ["iife"],
        name: "ServiceWorker",
        fileName: () => "sw.js",
      },
    },
    resolve: {
      alias: [
        { find: "@lib/rsc-service-worker-bff", replacement: path.resolve(libDir, "rsc-service-worker-bff/src") },
        // Ensure react-server entry is used for bare "react" imports within SW RSC bundle.
        { find: /^react$/, replacement: reactServerEntry },
        { find: /^react-dom$/, replacement: reactDomServerEntry },
        { find: "react-server-dom-webpack/server", replacement: "react-server-dom-webpack/server.browser" },
        { find: "react-server-dom-webpack/client", replacement: "react-server-dom-webpack/client.browser" },
      ],
      // Required for react-server-dom-webpack/server
      conditions: [mode, "react-server", "browser", "import", "default"],
    },
    plugins: [rscPrism({ mode: "worker" }), react()],
    define: { "process.env.NODE_ENV": JSON.stringify(mode) },
  });

  console.log("Built successfully");
  console.groupEnd();
}

export default defineConfig(({ mode }) => ({
  root: rootDir,
  publicDir: path.resolve(repoRoot, "public"),
  plugins: [
    tailwindcss(),
    rscPrism({ mode: "main" }),
    react({ babel: { plugins: ["babel-plugin-react-compiler"] } }),
    {
      name: "sw-builder",
      async buildStart() {
        await buildSW(mode as "development" | "production");
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === swConfig.serveUrl) {
            try {
              const content = await readFile(path.resolve(swConfig.outDir, "sw.js"), "utf-8");
              res.setHeader("Content-Type", "application/javascript");
              res.setHeader("Cache-Control", "no-cache");
              res.end(content);
              return;
            } catch (err) {
              console.error(`[SW] Error serving:`, err);
            }
          }
          next();
        });
      },
      async handleHotUpdate({ file, server }) {
        if (
          file.includes(swConfig.watchPattern) &&
          !file.includes(".sw-cache") &&
          !file.includes("node_modules")
        ) {
          console.log(`[SW] Detected change, rebuilding...`);
          await buildSW(mode as "development" | "production");
          server.ws.send({ type: "full-reload" });
          return;
        }
      },
      async writeBundle() {
        const distDir = path.resolve(rootDir, "dist");
        const swSource = path.resolve(swConfig.outDir, "sw.js");
        if (fs.existsSync(swSource)) {
          const dest = path.resolve(distDir, swConfig.serveUrl.slice(1));
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(swSource, dest);
          console.log(`[SW] Copied to dist`);
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
      "#": path.resolve(rootDir, "src/*"),
    },
  },
  worker: { format: "es" },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
    // Required for SAB to work in the browser
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
}));
