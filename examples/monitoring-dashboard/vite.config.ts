import path from "node:path";
import { readFile } from "node:fs/promises";
import fs from "node:fs";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, build as viteBuild } from "vite";

const rootDir = import.meta.dirname;

// Service worker config
const swConfig = {
  name: "monitoring-dashboard",
  entry: path.resolve(rootDir, "src/api/sw.tsx"),
  outDir: path.resolve(rootDir, ".sw-cache"),
  serveUrl: "/sw.js",
  watchPattern: "api/",
};

async function buildSW(mode: "development" | "production"): Promise<void> {
  console.group(`[SW:${swConfig.name}, ${mode}]`);
  console.log("Building...");

  await viteBuild({
    configFile: false,
    mode,
    root: path.dirname(swConfig.entry),
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
      alias: {
        "@": path.resolve(rootDir, "src"),
        "@/db": path.resolve(rootDir, "src/db"),
        "@db": path.resolve(rootDir, "src/db"),
      },
      conditions: [mode, "browser", "import", "default"],
    },
    plugins: [react()],
    define: { "process.env.NODE_ENV": JSON.stringify(mode) },
  });

  console.log("Built successfully");
  console.groupEnd();
}

export default defineConfig(({ mode }) => ({
  root: rootDir,
  plugins: [
    tailwindcss(),
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
        if (file.includes(swConfig.watchPattern) && !file.includes(".sw-cache")) {
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
          const dest = path.resolve(distDir, "sw.js");
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
      "#": path.resolve(rootDir, "src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
}));
