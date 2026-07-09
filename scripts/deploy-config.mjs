import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

const sourcePath = "wrangler.jsonc";
const outputPath = "wrangler.deploy.jsonc";
const localDeployEnvPath = ".env.deploy.local";

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

loadEnvFile(localDeployEnvPath);

const config = JSON.parse(readFileSync(sourcePath, "utf8"));
config.vars ??= {};

const varOverrides = {
  OG_ALLOWED_HOSTS: "ALLOWED_HOSTS",
  OG_ALLOW_SUBDOMAINS: "ALLOW_SUBDOMAINS",
  OG_ALLOWED_FORMATS: "ALLOWED_FORMATS",
  OG_BROWSER_POOL_MAX: "BROWSER_POOL_MAX",
  OG_CACHE_TTL_SECONDS: "CACHE_TTL_SECONDS",
  OG_ENABLE_PREFLIGHT: "ENABLE_PREFLIGHT",
  OG_ENVIRONMENT: "ENVIRONMENT",
  OG_MAX_HTML_BYTES: "MAX_HTML_BYTES",
  OG_MAX_NEW_URLS_PER_WINDOW: "MAX_NEW_URLS_PER_WINDOW",
  OG_MAX_RENDERS_PER_WINDOW: "MAX_RENDERS_PER_WINDOW",
  OG_PER_URL_COOLDOWN_SECONDS: "PER_URL_COOLDOWN_SECONDS",
  OG_REPOSITORY_URL: "REPOSITORY_URL",
  OG_USAGE_WINDOW_SECONDS: "USAGE_WINDOW_SECONDS",
};

for (const [envName, varName] of Object.entries(varOverrides)) {
  const value = process.env[envName];
  if (value) config.vars[varName] = value;
}

if (process.env.OG_WORKER_NAME) {
  config.name = process.env.OG_WORKER_NAME;
}

const accountId =
  process.env.OG_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;

if (accountId) {
  config.account_id = accountId;
}

if (process.env.OG_DOMAINS) {
  config.routes = process.env.OG_DOMAINS.split(",")
    .map((domain) => domain.trim())
    .filter(Boolean)
    .map((domain) => ({
      pattern: domain,
      custom_domain: true,
    }));
}

if (process.env.OG_R2_BUCKET) {
  for (const bucket of config.r2_buckets ?? []) {
    if (bucket.binding === "OG_CACHE") {
      bucket.bucket_name = process.env.OG_R2_BUCKET;
    }
  }
}

const requiredDeployEnv = [
  ["OG_ACCOUNT_ID", accountId],
  ["OG_ALLOWED_HOSTS", process.env.OG_ALLOWED_HOSTS],
  ["OG_DOMAINS", process.env.OG_DOMAINS],
  ["OG_REPOSITORY_URL", process.env.OG_REPOSITORY_URL],
];

const missingDeployEnv = requiredDeployEnv
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (
  missingDeployEnv.length > 0 &&
  process.env.OG_ALLOW_TEMPLATE_DEPLOY !== "true"
) {
  throw new Error(
    [
      "Refusing to generate a deploy config from template defaults.",
      `Set ${missingDeployEnv.join(", ")} in Cloudflare build settings,`,
      `${localDeployEnvPath}, or the command environment.`,
      "Use OG_ALLOW_TEMPLATE_DEPLOY=true only for template smoke tests.",
    ].join(" "),
  );
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(`${outputPath}.tmp`, `${JSON.stringify(config, null, 2)}\n`);
renameSync(`${outputPath}.tmp`, outputPath);

const hosts = config.vars.ALLOWED_HOSTS;
const bucket =
  config.r2_buckets?.find((item) => item.binding === "OG_CACHE")?.bucket_name ??
  "unknown";
const domains = config.routes
  ?.map((route) => (typeof route === "string" ? route : route.pattern))
  .join(", ");

console.log(`Generated ${outputPath}`);
console.log(`Worker: ${config.name}`);
console.log(`Allowed hosts: ${hosts}`);
console.log(`R2 bucket: ${bucket}`);
if (domains) console.log(`Domains: ${domains}`);
