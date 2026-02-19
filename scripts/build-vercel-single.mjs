import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const outputDir = path.resolve(repoRoot, "dist");

function run(command, env = {}) {
  console.log(`\n$ ${command}`);
  execSync(command, {
    stdio: "inherit",
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
  });
}

function copyDirectoryContents(sourceDir, destinationDir) {
  mkdirSync(destinationDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    cpSync(path.resolve(sourceDir, entry.name), path.resolve(destinationDir, entry.name), {
      recursive: true,
      force: true,
    });
  }
}

function flattenNestedBaseOutput(appDistDir, appBase) {
  const normalizedBase = appBase.replace(/^\/+|\/+$/g, "");
  if (normalizedBase.length === 0) {
    return;
  }

  const nestedDir = path.resolve(appDistDir, normalizedBase);
  if (!statSyncSafe(nestedDir)?.isDirectory()) {
    return;
  }

  copyDirectoryContents(nestedDir, appDistDir);
  rmSync(nestedDir, { recursive: true, force: true });
}

function statSyncSafe(targetPath) {
  try {
    return statSync(targetPath);
  } catch {
    return null;
  }
}

rmSync(outputDir, { recursive: true, force: true });

run("pnpm run build:lib");

run("pnpm --filter @examples/landing build");
copyDirectoryContents(path.resolve(repoRoot, "examples/landing/dist"), outputDir);

const moviesBase = "/movies-db/";
run("pnpm --filter movies-db build", { VITE_APP_BASE: moviesBase });
flattenNestedBaseOutput(path.resolve(repoRoot, "examples/movies-db/dist"), moviesBase);
copyDirectoryContents(
  path.resolve(repoRoot, "examples/movies-db/dist"),
  path.resolve(outputDir, "movies-db"),
);

const monitoringBase = "/monitoring-dashboard/";
run("pnpm --filter @examples/monitoring-dashboard build", {
  VITE_APP_BASE: monitoringBase,
});
flattenNestedBaseOutput(
  path.resolve(repoRoot, "examples/monitoring-dashboard/dist"),
  monitoringBase,
);
copyDirectoryContents(
  path.resolve(repoRoot, "examples/monitoring-dashboard/dist"),
  path.resolve(outputDir, "monitoring-dashboard"),
);

rmSync(path.resolve(repoRoot, "examples/monitoring-dashboard/.sw-cache"), {
  recursive: true,
  force: true,
});

console.log("\nSingle-project Vercel bundle ready in dist/");
