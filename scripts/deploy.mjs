#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const argv = new Set(process.argv.slice(2));
const dryRun = argv.has("--dry-run");
const root = process.cwd();

loadEnvFile(".env.deploy.local");

const deployId = git(["rev-parse", "HEAD"]);
const source =
  process.env.DEPLOY_SOURCE ??
  (process.env.GITHUB_ACTIONS
    ? "github"
    : process.env.CF_PAGES || process.env.CLOUDFLARE_BUILD_ID
      ? "cloudflare"
      : "local");
const statusUrl =
  process.env.OG_DEPLOY_STATUS_URL ??
  deployStatusUrlFromDomains(process.env.OG_DOMAINS);

if (!process.env.DEPLOY_ALLOW_DIRTY) {
  const dirty = git(["status", "--porcelain"]);
  if (dirty) {
    throw new Error(
      "Refusing to deploy a dirty worktree. Commit first or set DEPLOY_ALLOW_DIRTY=1.",
    );
  }
}

process.env.DEPLOYED_AT = new Date().toISOString();
process.env.DEPLOY_ID = deployId;
process.env.DEPLOY_SOURCE = source;
process.env.GIT_SHA = deployId;

if (!dryRun && statusUrl && (await isLive(deployId))) {
  console.log(`og ${deployId} is already live; skipping deploy.`);
  process.exit(0);
}

run("node", ["scripts/deploy-config.mjs"]);

const deployArgs = ["deploy", "--config", "wrangler.deploy.jsonc"];
if (dryRun) deployArgs.push("--dry-run");
run("wrangler", deployArgs);

if (!dryRun && statusUrl) await verifyLive(deployId);

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    process.env[key] ??= value;
  }
}

function deployStatusUrlFromDomains(domains) {
  const firstDomain = domains
    ?.split(",")
    .map((domain) => domain.trim())
    .find(Boolean);
  return firstDomain ? `https://${firstDomain}/.well-known/deploy.json` : null;
}

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function isLive(expectedDeployId) {
  const live = await readLiveMarker();
  return live?.deployId === expectedDeployId;
}

async function readLiveMarker() {
  try {
    const url = new URL(statusUrl);
    url.searchParams.set("deployCheck", String(Date.now()));
    const response = await fetch(url, {
      headers: { "cache-control": "no-cache" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function verifyLive(expectedDeployId) {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    if (await isLive(expectedDeployId)) {
      console.log(`og ${expectedDeployId} is live.`);
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 3000));
  }

  throw new Error(
    `Deploy finished, but ${statusUrl} did not report ${expectedDeployId}.`,
  );
}
