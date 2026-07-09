import { type Context, Hono } from "hono";
import {
  bumpCacheVersion,
  getCacheVersion,
  getFromCache,
  putInCache,
} from "../lib/og/cache";
import { assertConfigSafe, loadConfig, parseOptions } from "../lib/og/config";
import { serveFallback } from "../lib/og/fallback";
import { RenderGate, releaseRender, reserveRender } from "../lib/og/gate";
import { preflight } from "../lib/og/preflight";
import { shouldRedirectRoot } from "../lib/og/routes";
import { takeScreenshot } from "../lib/og/screenshot";
import { validateTarget } from "../lib/og/target";
import {
  cacheKey,
  extractUrlParam,
  type ScreenshotMode,
} from "../lib/og/utils";

export { RenderGate };

type HonoEnv = { Bindings: Cloudflare.Env };
type AppContext = Context<HonoEnv>;

const app = new Hono<HonoEnv>();
const inflightScreenshots = new Map<string, Promise<ArrayBuffer>>();

app.get("/", (c) => handleRoot(c));
app.get("/v1/og", (c) => handleRender(c));
app.get("/preview", (c) => handleRender(c, { bypassCache: true }));
app.get("/v1/preview", (c) => handleRender(c, { bypassCache: true }));
app.post("/purge", (c) => handlePurge(c));
app.post("/v1/purge", (c) => handlePurge(c));
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/v1/health", (c) => c.json({ status: "ok" }));
app.get("/.well-known/deploy.json", (c) =>
  c.json(
    {
      deployId: c.env.DEPLOY_ID ?? null,
      gitSha: c.env.GIT_SHA ?? null,
      source: c.env.DEPLOY_SOURCE ?? null,
      deployedAt: c.env.DEPLOYED_AT ?? null,
    },
    200,
    {
      "cache-control": "no-store",
    },
  ),
);
app.get("/favicon.ico", () => new Response(null, { status: 204 }));

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;

function handleRoot(c: AppContext): Response | Promise<Response> {
  const requestUrl = new URL(c.req.url);
  if (shouldRedirectRoot(requestUrl)) {
    return c.redirect(loadConfig(c.env).repositoryUrl, 302);
  }

  return handleRender(c);
}

async function handleRender(
  c: AppContext,
  options: { bypassCache?: boolean } = {},
): Promise<Response> {
  const config = loadConfig(c.env);
  const configError = assertConfigSafe(config);
  if (configError) {
    return c.json({ error: configError }, 500);
  }

  if (options.bypassCache) {
    const auth = await authorizeOwner(c);
    if (auth) return auth;
  }

  try {
    const requestUrl = new URL(c.req.url);
    const rawTargetUrl = extractUrlParam(requestUrl);
    if (!rawTargetUrl) {
      return c.json({ error: 'Missing required "url" query parameter' }, 400);
    }

    const target = validateTarget(rawTargetUrl, config);
    if (!target.ok) {
      return c.json({ error: target.error }, target.status);
    }

    const parsedOptions = parseOptions(requestUrl.searchParams, config);
    if ("error" in parsedOptions) {
      return c.json({ error: parsedOptions.error }, 400);
    }

    const { host, requestedUrl, targetUrl, usedHomepageFallback } =
      target.target;
    const mode: ScreenshotMode = { mode: "url", url: targetUrl };
    const purgeVersion = await getCacheVersion({ env: c.env, url: targetUrl });
    const key = await cacheKey(mode, parsedOptions, purgeVersion);

    if (!options.bypassCache) {
      const cached = await getFromCache({
        env: c.env,
        key,
        requestUrl: c.req.url,
        options: parsedOptions,
      });
      if (cached) return cached;
    }

    const image = await renderOnce(key, async () => {
      if (config.enablePreflight && !c.env.DEV_SCREENSHOT_URL) {
        const check = await preflight({
          mode,
          maxResponseBytes: config.maxHtmlBytes,
        });
        if (!check.ok) {
          throw new PreflightError(check.error, check.hint);
        }
      }

      if (options.bypassCache) {
        return takeScreenshot(c.env, mode, parsedOptions);
      }

      const gate = await reserveRender({
        env: c.env,
        url: targetUrl,
        config,
      });
      if (gate.action === "fallback") {
        throw new RenderGateDecision(gate.reason, gate.retryAfter);
      }

      try {
        return await takeScreenshot(c.env, mode, parsedOptions);
      } finally {
        c.executionCtx.waitUntil(
          releaseRender({ env: c.env, ticketId: gate.ticketId }),
        );
      }
    });

    return putInCache({
      env: c.env,
      key,
      requestUrl: c.req.url,
      image,
      options: parsedOptions,
      metadata: {
        sourceUrl: mode.url,
        requestedSourceUrl: requestedUrl,
        originHostname: host,
        homepageFallback: usedHomepageFallback ? "true" : "false",
        format: parsedOptions.format,
        cacheTtl: String(parsedOptions.cacheTtl),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof RenderGateDecision) {
      return serveFallback({
        env: c.env,
        reason: error.reason,
        retryAfter: error.retryAfter,
      });
    }

    if (error instanceof PreflightError) {
      return c.json({ error: error.message, hint: error.hint }, 422);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const mapped = mapRuntimeError(message);
    console.error("OG render failed:", message);
    return c.json(mapped.body, mapped.status);
  }
}

async function handlePurge(c: AppContext): Promise<Response> {
  const authError = await authorizeOwner(c);
  if (authError) return authError;

  const config = loadConfig(c.env);
  const configError = assertConfigSafe(config);
  if (configError) {
    return c.json({ error: configError }, 500);
  }

  try {
    const body = (await c.req.json()) as { url?: string; urls?: string[] };
    const urls = Array.isArray(body.urls)
      ? body.urls
      : body.url
        ? [body.url]
        : [];
    if (urls.length === 0) {
      return c.json({ error: "Missing url or urls" }, 400);
    }

    const results = [];
    for (const url of urls) {
      const target = validateTarget(url, config);
      if (!target.ok) {
        results.push({ url, ok: false, error: target.error });
        continue;
      }

      const version = await bumpCacheVersion({
        env: c.env,
        url: target.target.targetUrl,
      });
      results.push({ url: target.target.targetUrl, ok: true, version });
    }

    return c.json({
      purged: results.every((result) => result.ok),
      results,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
}

async function authorizeOwner(c: AppContext): Promise<Response | null> {
  const expected = c.env.PURGE_TOKEN;
  if (!expected) {
    return c.json({ error: "Not found" }, 404);
  }

  const provided =
    bearerToken(c.req.header("authorization")) ?? c.req.header("x-purge-token");

  if (!provided || !timingSafeEqual(provided, expected)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": "Bearer",
      },
    });
  }

  return null;
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.max(left.length, right.length, 1);
  let diff = left.length ^ right.length;

  for (let i = 0; i < length; i += 1) {
    diff |= (left[i % left.length] ?? 0) ^ (right[i % right.length] ?? 0);
  }

  return diff === 0;
}

function renderOnce(
  key: string,
  create: () => Promise<ArrayBuffer>,
): Promise<ArrayBuffer> {
  const existing = inflightScreenshots.get(key);
  if (existing) return existing;

  const promise = create().finally(() => {
    inflightScreenshots.delete(key);
  });
  inflightScreenshots.set(key, promise);
  return promise;
}

function mapRuntimeError(message: string): {
  status: 422 | 502 | 500;
  body: { error: string; message: string };
} {
  if (message.includes("No OG template found")) {
    return {
      status: 422,
      body: { error: "template_missing", message },
    };
  }
  if (message.includes("Page returned")) {
    return {
      status: 422,
      body: { error: "target_page_error", message },
    };
  }
  if (message.includes("Screenshot service error")) {
    return {
      status: 502,
      body: { error: "renderer_unavailable", message },
    };
  }
  return {
    status: 500,
    body: { error: "internal_error", message },
  };
}

class PreflightError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "PreflightError";
  }
}

class RenderGateDecision extends Error {
  constructor(
    readonly reason:
      | "pool_exhausted"
      | "render_budget"
      | "page_limit"
      | "cooldown",
    readonly retryAfter?: number,
  ) {
    super(reason);
    this.name = "RenderGateDecision";
  }
}
