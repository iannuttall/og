#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const DEFAULT_BASE_URL = process.env.OG_BASE_URL ?? "http://127.0.0.1:8787";

const [command, ...args] = process.argv.slice(2);

if (!command || command === "help" || command === "--help") {
  help();
  process.exit(0);
}

if (command === "url") {
  const target = requireArg(args[0], "target URL");
  console.log(`${DEFAULT_BASE_URL}/?url=${encodeURIComponent(target)}`);
  process.exit(0);
}

if (command === "render" || command === "preview") {
  const target = requireArg(args[0], "target URL");
  const out = readFlag(args, "--out") ?? "og.png";
  const token = process.env.PURGE_TOKEN;
  const path = command === "preview" ? "/preview" : "/";
  const response = await fetch(
    `${DEFAULT_BASE_URL}${path}?url=${encodeURIComponent(target)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
  writeFileSync(out, Buffer.from(await response.arrayBuffer()));
  console.log(`Wrote ${out}`);
  process.exit(0);
}

if (command === "purge") {
  const target = requireArg(args[0], "target URL");
  const token = process.env.PURGE_TOKEN;
  if (!token) {
    throw new Error("Set PURGE_TOKEN before running purge");
  }
  const response = await fetch(`${DEFAULT_BASE_URL}/purge`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: target }),
  });
  console.log(await response.text());
  process.exit(response.ok ? 0 : 1);
}

if (command === "doctor") {
  const envExample = readFileSync(".dev.vars.example", "utf8");
  const required = [
    "ALLOWED_HOSTS",
    "ALLOWED_FORMATS",
    "BROWSER_POOL_MAX",
    "CACHE_TTL_SECONDS",
    "MAX_RENDERS_PER_WINDOW",
    "MAX_NEW_URLS_PER_WINDOW",
    "PER_URL_COOLDOWN_SECONDS",
  ];
  const missing = required.filter((key) => !envExample.includes(`${key}=`));
  if (missing.length > 0) {
    console.error(`Missing from .dev.vars.example: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("Local OG config shape looks ok");
  process.exit(0);
}

throw new Error(`Unknown command: ${command}`);

function help() {
  console.log(`Usage:
  pnpm og url <target-url>
  pnpm og render <target-url> [--out og.png]
  pnpm og preview <target-url> [--out og.png]
  pnpm og purge <target-url>
  pnpm og doctor

Environment:
  OG_BASE_URL    Defaults to ${DEFAULT_BASE_URL}
  PURGE_TOKEN    Required for preview and purge when the Worker is configured
`);
}

function requireArg(value, label) {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

function readFlag(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}
