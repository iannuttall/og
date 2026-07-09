export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const OG_SCALE = 2;
export const OG_FORMAT = "png" as const;
export const OG_CACHE_TTL = 86400 * 30; // 30 days

export const OG_READY_SIGNAL = "window.__OG_READY__ === true";

export const WORKER_PARAMS = new Set(["format", "quality", "cacheTtl", "v"]);

export type OgFormat = "png" | "jpeg" | "webp";

export interface OGImageOptions {
  format: OgFormat;
  quality?: number;
  cacheTtl: number;
}

export interface ScreenshotMode {
  mode: "url";
  url: string;
}

export function contentType(format: OgFormat = "png"): string {
  const map = {
    png: "image/png",
    jpeg: "image/jpeg",
    webp: "image/webp",
  } as const;
  return map[format];
}

/**
 * Extract the `url` param from the raw query string, preserving any query
 * params that belong to the target URL (stops when it hits a known worker param).
 */
export function extractUrlParam(url: URL): string | null {
  const raw = url.search.slice(1);
  const parts = raw.split("&");

  let capturing = false;
  const segments: string[] = [];

  for (const part of parts) {
    if (!capturing) {
      if (part.startsWith("url=")) {
        capturing = true;
        segments.push(part.slice(4));
      }
    } else {
      const key = part.split("=")[0];
      if (WORKER_PARAMS.has(key)) break;
      segments.push(part);
    }
  }

  if (segments.length === 0) return null;
  const result = decodeURIComponent(segments.join("&"));
  return result || null;
}

/**
 * JavaScript evaluated in the browser to extract the OG template and
 * replace the page body with it.
 */
export const OG_TEMPLATE_EXTRACT_SCRIPT = `
(async () => {
  const tpl = document.querySelector('template[data-og-template]');
  if (!tpl) return null;

  const width = parseInt(tpl.getAttribute('data-og-width') || '1200', 10);
  const height = parseInt(tpl.getAttribute('data-og-height') || '630', 10);

  document.documentElement.style.cssText = 'margin:0!important;padding:0!important;overflow:hidden!important;scrollbar-width:none!important;';
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0!important;padding:0!important;width:' + width + 'px!important;height:' + height + 'px!important;overflow:hidden!important;position:relative!important;';

  var s = document.createElement('style');
  s.textContent = '::-webkit-scrollbar{display:none!important}';
  document.head.appendChild(s);

  const content = tpl.content.cloneNode(true);
  document.body.appendChild(content);

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const images = Array.from(document.images);
  await Promise.all(images.map((image) => {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    if (image.decode) return image.decode().catch(() => {});
    return new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  }));

  window.scrollTo(0, 0);

  return { width, height };
})()
`;

/**
 * SHA-256 hex hash of the screenshot mode, used as cache key.
 */
export async function cacheKey(
  mode: ScreenshotMode,
  options: OGImageOptions,
  purgeVersion = "0",
): Promise<string> {
  const format = options.format;
  const quality = normalizeQuality(options.quality);
  const payload = JSON.stringify({
    mode: mode.mode,
    url: mode.url,
    purgeVersion: purgeVersion === "0" ? undefined : purgeVersion,
    format,
    quality: format === "png" ? undefined : quality,
  });
  return sha256Hex(payload);
}

export async function sourceUrlKey(url: string): Promise<string> {
  return sha256Hex(url);
}

export function intParam(params: URLSearchParams, key: string): number | null {
  const v = params.get(key);
  if (v == null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function normalizeQuality(
  quality: number | undefined,
): number | undefined {
  if (quality == null) return undefined;
  const clamped = Math.min(100, Math.max(1, Math.trunc(quality)));
  return Number.isFinite(clamped) ? clamped : undefined;
}

export function enumParam<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: T[],
): T | null {
  const v = params.get(key);
  if (v == null) return null;
  return (allowed as string[]).includes(v) ? (v as T) : null;
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
