import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const defaultMaxLines = 350;
const hardMaxLines = 1000;

const allowlist = new Map([
  ["examples/generate.mjs", 500],
  ["src/worker/index.ts", 350],
]);

const ignoredDirs = new Set([
  ".git",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
]);

const ignoredFiles = new Set(["src/worker-configuration.d.ts"]);
const extensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

const files = await collect(root);
const failures = [];

for (const file of files) {
  const relative = path.relative(root, file);
  const maxLines = Math.min(
    allowlist.get(relative) ?? defaultMaxLines,
    hardMaxLines,
  );
  const content = await readFile(file, "utf8");
  const lines = content.endsWith("\n")
    ? content.split("\n").length - 1
    : content.split("\n").length;

  if (lines > maxLines) {
    failures.push({ relative, lines, maxLines });
  }
}

if (failures.length > 0) {
  console.error("File line limit failed:");
  for (const failure of failures) {
    console.error(
      `- ${failure.relative}: ${failure.lines} lines, max ${failure.maxLines}`,
    );
  }
  process.exitCode = 1;
}

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      results.push(...(await collect(path.join(dir, entry.name))));
      continue;
    }

    if (!entry.isFile()) continue;

    const fullPath = path.join(dir, entry.name);
    const relative = path.relative(root, fullPath);

    if (ignoredFiles.has(relative)) continue;
    if (!extensions.has(path.extname(entry.name))) continue;

    results.push(fullPath);
  }

  return results;
}
