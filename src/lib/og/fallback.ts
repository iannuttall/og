import { contentType } from "./utils";

const INLINE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgQAYAAA4AAcPBdyAAAAAASUVORK5CYII=";

const inlineBuffer = (() => {
  const binary = atob(INLINE_PNG_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
})();

export async function serveFallback(params: {
  env: Cloudflare.Env;
  reason: string;
  retryAfter?: number;
}): Promise<Response> {
  const fallbackUrl = params.env.DEFAULT_FALLBACK_IMAGE_URL?.trim();
  const headers = new Headers({
    "Cache-Control": "public, max-age=60",
    "Content-Type": contentType("png"),
    "X-OG-Fallback": params.reason,
  });

  if (params.retryAfter) {
    headers.set("Retry-After", String(params.retryAfter));
  }

  if (fallbackUrl) {
    try {
      const response = await fetch(fallbackUrl, {
        headers: { Accept: "image/png,image/*" },
      });
      if (response.ok) {
        headers.set(
          "Content-Type",
          response.headers.get("Content-Type") ?? contentType("png"),
        );
        return new Response(response.body, { headers });
      }
    } catch {
      // Fall back to the inline image below.
    }
  }

  return new Response(inlineBuffer, { headers });
}
