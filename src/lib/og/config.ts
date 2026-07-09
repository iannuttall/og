import {
  enumParam,
  intParam,
  normalizeQuality,
  OG_CACHE_TTL,
  OG_FORMAT,
  type OGImageOptions,
  type OgFormat,
} from "./utils";

const SUPPORTED_FORMATS: OgFormat[] = ["png", "jpeg", "webp"];

export interface AppConfig {
  allowedHosts: string[];
  allowSubdomains: boolean;
  allowedFormats: OgFormat[];
  browserPoolMax: number;
  cacheTtlSeconds: number;
  enablePreflight: boolean;
  environment: "development" | "production" | "preview";
  maxHtmlBytes: number;
  maxNewUrlsPerWindow: number;
  maxRendersPerWindow: number;
  perUrlCooldownSeconds: number;
  repositoryUrl: string;
  usageWindowSeconds: number;
}

export function loadConfig(env: Cloudflare.Env): AppConfig {
  const environment = normalizeEnvironment(env.ENVIRONMENT);

  return {
    allowedHosts: parseAllowedHosts(env.ALLOWED_HOSTS),
    allowSubdomains: parseBoolean(env.ALLOW_SUBDOMAINS, false),
    allowedFormats: parseAllowedFormats(env.ALLOWED_FORMATS),
    browserPoolMax: intEnv(env.BROWSER_POOL_MAX, 2, { min: 1, max: 10 }),
    cacheTtlSeconds: intEnv(env.CACHE_TTL_SECONDS, OG_CACHE_TTL, {
      min: 60,
      max: 60 * 60 * 24 * 365,
    }),
    enablePreflight: parseBoolean(
      env.ENABLE_PREFLIGHT,
      environment !== "development",
    ),
    environment,
    maxHtmlBytes: intEnv(env.MAX_HTML_BYTES, 5 * 1024 * 1024, {
      min: 64 * 1024,
      max: 10 * 1024 * 1024,
    }),
    maxNewUrlsPerWindow: intEnv(env.MAX_NEW_URLS_PER_WINDOW, 500, {
      min: 1,
      max: 100_000,
    }),
    maxRendersPerWindow: intEnv(env.MAX_RENDERS_PER_WINDOW, 1000, {
      min: 1,
      max: 1_000_000,
    }),
    perUrlCooldownSeconds: intEnv(env.PER_URL_COOLDOWN_SECONDS, 3600, {
      min: 0,
      max: 60 * 60 * 24 * 30,
    }),
    repositoryUrl: stringEnv(
      env.REPOSITORY_URL,
      "https://github.com/your-name/og",
    ),
    usageWindowSeconds: intEnv(env.USAGE_WINDOW_SECONDS, 60 * 60 * 24 * 30, {
      min: 60,
      max: 60 * 60 * 24 * 365,
    }),
  };
}

export function parseOptions(
  params: URLSearchParams,
  config: AppConfig,
): OGImageOptions | { error: string } {
  const requestedFormat =
    enumParam<OgFormat>(params, "format", SUPPORTED_FORMATS) ?? OG_FORMAT;

  if (!config.allowedFormats.includes(requestedFormat)) {
    return {
      error: `Format "${requestedFormat}" is not allowed by this worker`,
    };
  }

  const requestedTtl = intParam(params, "cacheTtl");
  const cacheTtl =
    requestedTtl == null
      ? config.cacheTtlSeconds
      : Math.min(config.cacheTtlSeconds, Math.max(60, requestedTtl));

  return {
    format: requestedFormat,
    quality: normalizeQuality(intParam(params, "quality") ?? undefined),
    cacheTtl,
  };
}

export function assertConfigSafe(config: AppConfig): string | null {
  if (config.allowedHosts.length === 0) {
    return "Worker is misconfigured: ALLOWED_HOSTS is empty";
  }

  if (
    config.allowedHosts.includes("*") &&
    config.environment !== "development"
  ) {
    return 'Worker is misconfigured: wildcard ALLOWED_HOSTS ("*") is only allowed in development';
  }

  return null;
}

function parseAllowedHosts(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => {
      if (entry === "*") return entry;
      try {
        return new URL(entry).hostname.toLowerCase();
      } catch {
        return entry;
      }
    });
}

function parseAllowedFormats(raw: string | undefined): OgFormat[] {
  if (!raw) return [OG_FORMAT];
  const formats = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is OgFormat =>
      (SUPPORTED_FORMATS as string[]).includes(entry),
    );
  return formats.length > 0 ? formats : [OG_FORMAT];
}

export function parseBoolean(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value == null) return fallback;
  return value.toLowerCase() === "true";
}

function intEnv(
  value: string | undefined,
  fallback: number,
  bounds: { min: number; max: number },
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(bounds.max, Math.max(bounds.min, Math.trunc(parsed)));
}

function stringEnv(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeEnvironment(
  value: string | undefined,
): AppConfig["environment"] {
  if (value === "development" || value === "preview") return value;
  return "production";
}
