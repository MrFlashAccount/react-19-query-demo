import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
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

rmSync(outputDir, { recursive: true, force: true });

run("pnpm --filter @examples/landing build");
copyDirectoryContents(path.resolve(repoRoot, "examples/landing/dist"), outputDir);

run("pnpm --filter movies-db build", { VITE_APP_BASE: "/movies-db/" });
copyDirectoryContents(
  path.resolve(repoRoot, "examples/movies-db/dist"),
  path.resolve(outputDir, "movies-db"),
);

run("pnpm --filter @examples/monitoring-dashboard build", {
  VITE_APP_BASE: "/monitoring-dashboard/",
});
copyDirectoryContents(
  path.resolve(repoRoot, "examples/monitoring-dashboard/dist"),
  path.resolve(outputDir, "monitoring-dashboard"),
);

rmSync(path.resolve(repoRoot, "examples/monitoring-dashboard/.sw-cache"), {
  recursive: true,
  force: true,
});

console.log("\nSingle-project Vercel bundle ready in dist/");
