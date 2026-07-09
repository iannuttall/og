import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const sourcePath = "wrangler.jsonc";
const outputPath = "wrangler.deploy.jsonc";

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
  OG_USAGE_WINDOW_SECONDS: "USAGE_WINDOW_SECONDS",
};

for (const [envName, varName] of Object.entries(varOverrides)) {
  const value = process.env[envName];
  if (value) config.vars[varName] = value;
}

if (process.env.OG_WORKER_NAME) {
  config.name = process.env.OG_WORKER_NAME;
}

if (process.env.OG_ACCOUNT_ID) {
  config.account_id = process.env.OG_ACCOUNT_ID;
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
