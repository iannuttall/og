import {
  contentType,
  OG_FORMAT,
  type OGImageOptions,
  sourceUrlKey,
} from "./utils";

const CACHE_VERSION_PREFIX = "__versions__/";

/**
 * Try to serve from the Cache API (edge cache), then fall back to R2 (persistent).
 * Returns null on full cache miss.
 */
export async function getFromCache({
  env,
  key,
  requestUrl,
  options,
}: {
  env: Cloudflare.Env;
  key: string;
  requestUrl: string;
  options: OGImageOptions;
}): Promise<Response | null> {
  const cacheTtl = options.cacheTtl;
  const format = options.format ?? OG_FORMAT;

  // 1. Edge cache (fastest)
  const cache = caches.default;
  const cacheUrl = new URL(`/cache/${key}`, requestUrl);
  const cacheRequest = new Request(cacheUrl.toString());
  const cached = await cache.match(cacheRequest);
  if (cached) {
    return cached;
  }

  // 2. R2 (persistent)
  const r2Object = await env.OG_CACHE.get(key);
  if (r2Object) {
    const headers = new Headers({
      "Content-Type": contentType(format),
      "Cache-Control": `public, max-age=${cacheTtl}`,
    });
    const response = new Response(r2Object.body, { headers });

    // Backfill edge cache (non-blocking)
    void cache.put(cacheRequest, response.clone()).catch(() => {});

    return response;
  }

  return null;
}

/**
 * Store a screenshot in both R2 and the edge cache.
 */
export async function putInCache({
  env,
  key,
  requestUrl,
  image,
  options,
  metadata,
}: {
  env: Cloudflare.Env;
  key: string;
  requestUrl: string;
  image: ArrayBuffer;
  options: OGImageOptions;
  metadata?: Record<string, string>;
}): Promise<Response> {
  const cacheTtl = options.cacheTtl;
  const format = options.format ?? OG_FORMAT;

  // Store in R2
  await env.OG_CACHE.put(key, image, {
    httpMetadata: { contentType: contentType(format) },
    ...(metadata ? { customMetadata: metadata } : {}),
  });

  const headers = new Headers({
    "Content-Type": contentType(format),
    "Cache-Control": `public, max-age=${cacheTtl}`,
  });

  const response = new Response(image, { headers });

  // Store in edge cache (non-blocking)
  const cache = caches.default;
  const cacheUrl = new URL(`/cache/${key}`, requestUrl);
  const cacheRequest = new Request(cacheUrl.toString());
  void cache.put(cacheRequest, response.clone()).catch(() => {});

  return response;
}

export async function getCacheVersion({
  env,
  url,
}: {
  env: Cloudflare.Env;
  url: string;
}): Promise<string> {
  const versionObject = await env.OG_CACHE.get(await versionObjectKey(url));
  if (!versionObject) return "0";

  const version = await versionObject.text();
  return version || "0";
}

export async function bumpCacheVersion({
  env,
  url,
}: {
  env: Cloudflare.Env;
  url: string;
}): Promise<string> {
  const version = Date.now().toString(36);
  await env.OG_CACHE.put(await versionObjectKey(url), version, {
    httpMetadata: { contentType: "text/plain" },
  });
  return version;
}

async function versionObjectKey(url: string): Promise<string> {
  return `${CACHE_VERSION_PREFIX}${await sourceUrlKey(url)}`;
}
