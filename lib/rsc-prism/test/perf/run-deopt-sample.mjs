import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { buildDeoptReport } from "./parse-deopt-log.mjs";

async function resolveVitestEntrypoint(packageDir) {
  const pnpmStoreDir = path.resolve(packageDir, "../../node_modules/.pnpm");
  const entries = await readdir(pnpmStoreDir, { withFileTypes: true });
  const vitestDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("vitest@"))
    .map((entry) => entry.name)
    .sort();
  if (vitestDirs.length === 0) {
    throw new Error(`Unable to locate vitest in ${pnpmStoreDir}`);
  }
  return path.join(pnpmStoreDir, vitestDirs[0], "node_modules/vitest/vitest.mjs");
}

function readEnvNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw.length === 0) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function run() {
  const packageDir = process.cwd();
  const vitestEntrypoint = await resolveVitestEntrypoint(packageDir);
  const logPath = process.env.RSC_DEOPT_LOG_PATH ?? "/tmp/rsc-prism-deopt-sample.latest.log";
  const reportPath = path.resolve(packageDir, "test/perf/results/deopt-sample-latest.md");
  const iterations = readEnvNumber("RSC_PERF_ITERATIONS", 120);
  const rowCount = readEnvNumber("RSC_PERF_ROW_COUNT", 12000);
  const binaryRowCount = readEnvNumber("RSC_PERF_BINARY_ROW_COUNT", 4000);
  const binaryRowBytes = readEnvNumber("RSC_PERF_BINARY_ROW_BYTES", 384);

  const testFiles = [
    "test/perf/flight-runtime.client-stream-perf.unit.test.ts",
    "test/perf/flight-runtime.decode-perf.unit.test.ts",
    "test/perf/flight-runtime.server-decode-reply-perf.unit.test.ts",
  ];

  const args = [
    "--trace-opt",
    "--trace-deopt",
    "--trace-file-names",
    vitestEntrypoint,
    "run",
    "--project",
    "unit",
    ...testFiles,
  ];

  console.log("[rsc-prism deopt] running sampled perf suite with trace flags");
  const child = spawn(process.execPath, args, {
    cwd: packageDir,
    env: {
      ...process.env,
      RSC_PERF: "1",
      RSC_PERF_ITERATIONS: String(iterations),
      RSC_PERF_ROW_COUNT: String(rowCount),
      RSC_PERF_BINARY_ROW_COUNT: String(binaryRowCount),
      RSC_PERF_BINARY_ROW_BYTES: String(binaryRowBytes),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  });
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stderr.write(text);
  });

  const exitCode = await new Promise((resolve) => {
    child.on("close", (code) => resolve(code ?? 1));
  });

  await writeFile(logPath, output, "utf8");
  if (exitCode !== 0) {
    throw new Error(`[rsc-prism deopt] trace run failed with exit code ${exitCode}. Log: ${logPath}`);
  }

  const result = await buildDeoptReport({
    inputPath: logPath,
    outputPath: reportPath,
    srcDir: path.resolve(packageDir, "src"),
  });
  console.log(
    `[rsc-prism deopt] report written to ${result.outputPath} (all=${result.totalDeopts}, package=${result.packageDeopts})`,
  );
}

await run();
