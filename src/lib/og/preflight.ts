import type { ScreenshotMode } from "./utils";

const PREFLIGHT_TIMEOUT_MS = 8000;

export interface PreflightResult {
  ok: true;
  url: string;
}

export interface PreflightError {
  ok: false;
  error: string;
  hint?: string;
}

/**
 * Lightweight validation of the target page before we spend resources
 * on Browser Rendering. Catches common problems cheaply.
 *
 * Checks:
 * 1. URL uses HTTPS
 * 2. Page returns 200 with an HTML content type
 * 3. Response body contains a data-og-template element
 * 4. Response isn't suspiciously large (likely not an HTML page)
 */
export async function preflight({
  mode,
  maxResponseBytes,
}: {
  mode: ScreenshotMode;
  maxResponseBytes: number;
}): Promise<PreflightResult | PreflightError> {
  // 1. Require HTTPS
  try {
    const parsed = new URL(mode.url);
    if (parsed.protocol !== "https:") {
      return {
        ok: false,
        error: `Target URL must use HTTPS, got ${parsed.protocol}`,
        hint: "Change your URL to use https://",
      };
    }
  } catch {
    return { ok: false, error: "Invalid target URL" };
  }

  // 2. Fetch the page
  let res: Response;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS);

    res = await fetch(mode.url, {
      method: "GET",
      headers: {
        Accept: "text/html",
        "User-Agent": "og-preflight/1.0",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("abort")) {
      return {
        ok: false,
        error: `Preflight timed out after ${PREFLIGHT_TIMEOUT_MS}ms: ${mode.url}`,
        hint: "Make sure the page loads quickly. The preflight fetch has an 8-second timeout.",
      };
    }
    return {
      ok: false,
      error: `Could not reach ${mode.url}: ${message}`,
      hint: "Check that the URL is correct and the server is reachable.",
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  // 3. Check HTTP status
  if (!res.ok) {
    return {
      ok: false,
      error: `Page returned HTTP ${res.status}: ${mode.url}`,
      hint:
        res.status === 404
          ? "The page doesn't exist. Check the URL."
          : res.status >= 500
            ? "The server returned an error. Try again later."
            : "The page returned a non-200 status code.",
    };
  }

  // 4. Check Content-Type
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) {
    return {
      ok: false,
      error: `Expected text/html but got "${ct}" for ${mode.url}`,
      hint: "The URL should point to an HTML page, not a JSON API, image, or other resource.",
    };
  }

  // 5. Check body size before reading
  const contentLength = res.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxResponseBytes) {
    return {
      ok: false,
      error: `Response too large (${contentLength} bytes) for ${mode.url}`,
      hint: "The page is unusually large. OG templates should be on normal-sized HTML pages.",
    };
  }

  // 6. Read body and check for template
  const reader = res.body?.getReader();
  if (!reader) {
    return {
      ok: false,
      error: `Could not read response body for ${mode.url}`,
    };
  }

  let received = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > maxResponseBytes) {
      await reader.cancel();
      return {
        ok: false,
        error: `Response too large (${received} bytes) for ${mode.url}`,
        hint: "The page is unusually large. OG templates should be on normal-sized HTML pages.",
      };
    }
    chunks.push(value);
  }

  const html = new TextDecoder().decode(concatChunks(chunks, received));

  if (!html.includes("data-og-template")) {
    return {
      ok: false,
      error: `No OG template found on ${mode.url}`,
      hint: 'Add a <template data-og-template data-og-width="1200" data-og-height="630"> element to your page.',
    };
  }

  return { ok: true, url: mode.url };
}

function concatChunks(chunks: Uint8Array[], length: number): Uint8Array {
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
