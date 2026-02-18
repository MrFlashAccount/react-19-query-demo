import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    input: "",
    output: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--input") {
      args.input = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (value === "--output") {
      args.output = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
  }
  if (args.input.length === 0) {
    throw new Error("Missing required --input argument.");
  }
  if (args.output.length === 0) {
    throw new Error("Missing required --output argument.");
  }
  return args;
}

async function collectSourceFunctionNames(srcDir) {
  const functionNames = new Set();

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!fullPath.endsWith(".ts") && !fullPath.endsWith(".tsx")) continue;

      const source = await readFile(fullPath, "utf8");
      const matches = source.matchAll(/\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g);
      for (const match of matches) {
        functionNames.add(match[1]);
      }
    }
  }

  await walk(srcDir);
  return functionNames;
}

function parseDeoptEntries(logText) {
  const deoptEntries = [];
  const lines = logText.split("\n");
  const deoptPattern =
    /\[bailout \(kind: ([^,]+), reason: ([^)]+)\): begin\. deoptimizing .*<JSFunction ([^<>(]*)(?: <([^>]+)>)?/;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = deoptPattern.exec(line);
    if (match == null) continue;
    const kind = match[1].trim();
    const reason = match[2].trim();
    const functionName = match[3].trim().length > 0 ? match[3].trim() : "(anonymous)";
    const sourcePath = match[4]?.trim() ?? "";
    deoptEntries.push({ kind, reason, functionName, sourcePath, line });
  }
  return deoptEntries;
}

function summarizeCounts(items) {
  const counts = new Map();
  for (let i = 0; i < items.length; i += 1) {
    const key = items[i];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

function formatTopRows(rows, limit = 10) {
  const lines = [];
  const capped = rows.slice(0, limit);
  for (let i = 0; i < capped.length; i += 1) {
    const [name, count] = capped[i];
    lines.push(`- \`${name}\`: ${count}`);
  }
  if (lines.length === 0) {
    lines.push("- _(none)_");
  }
  return lines.join("\n");
}

export async function buildDeoptReport({ inputPath, outputPath, srcDir }) {
  const [logText, sourceFunctionNames] = await Promise.all([
    readFile(inputPath, "utf8"),
    collectSourceFunctionNames(srcDir),
  ]);
  const deoptEntries = parseDeoptEntries(logText);
  const normalizedSrcDir = srcDir.replaceAll("\\", "/");
  const packageEntries = deoptEntries.filter((entry) => {
    if (
      entry.sourcePath.length > 0 &&
      entry.sourcePath.replaceAll("\\", "/").includes(normalizedSrcDir)
    ) {
      return true;
    }
    return sourceFunctionNames.has(entry.functionName);
  });

  const allReasonCounts = summarizeCounts(deoptEntries.map((entry) => entry.reason));
  const packageReasonCounts = summarizeCounts(packageEntries.map((entry) => entry.reason));
  const packageFunctionCounts = summarizeCounts(packageEntries.map((entry) => entry.functionName));

  const markdown = [
    "# rsc-prism deopt sample report",
    "",
    `- Generated at: ${new Date().toISOString()}`,
    `- Input log: \`${inputPath}\``,
    `- Source filter root: \`${srcDir}\``,
    "",
    "## Totals",
    "",
    `- Deopt events (all): ${deoptEntries.length}`,
    `- Deopt events (matched package functions): ${packageEntries.length}`,
    "",
    "## Top Deopt Reasons (All)",
    "",
    formatTopRows(allReasonCounts),
    "",
    "## Top Deopt Reasons (Matched Package Functions)",
    "",
    formatTopRows(packageReasonCounts),
    "",
    "## Top Deoptimized Package Functions",
    "",
    formatTopRows(packageFunctionCounts),
    "",
    "## Notes",
    "",
    "- Package-function matching prefers deopt source paths under `src/`, with a function-name fallback.",
    "- This report is intended for trend tracking, not as a hard CI gate.",
    "",
  ].join("\n");

  await writeFile(outputPath, markdown, "utf8");
  return {
    totalDeopts: deoptEntries.length,
    packageDeopts: packageEntries.length,
    outputPath,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const srcDir = path.resolve(cwd, "src");
  const inputPath = path.resolve(cwd, args.input);
  const outputPath = path.resolve(cwd, args.output);
  const result = await buildDeoptReport({
    inputPath,
    outputPath,
    srcDir,
  });
  console.log(
    `[rsc-prism deopt] wrote ${result.outputPath} (all=${result.totalDeopts}, package=${result.packageDeopts})`,
  );
}
