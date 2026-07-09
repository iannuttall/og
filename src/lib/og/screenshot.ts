import puppeteer, { type Browser } from "@cloudflare/puppeteer";
import {
  OG_HEIGHT,
  OG_READY_SIGNAL,
  OG_SCALE,
  OG_TEMPLATE_EXTRACT_SCRIPT,
  OG_WIDTH,
  type OGImageOptions,
  type ScreenshotMode,
} from "./utils";

let sharedBrowser: Browser | null = null;
let browserInit: Promise<Browser> | null = null;

/**
 * Take a screenshot. Chooses strategy based on env:
 * - DEV_SCREENSHOT_URL → local HTTP screenshot service
 * - Otherwise → CF Browser Rendering directly (for `wrangler dev --remote`)
 */
export async function takeScreenshot(
  env: Cloudflare.Env,
  mode: ScreenshotMode,
  options: OGImageOptions,
): Promise<ArrayBuffer> {
  if (env.DEV_SCREENSHOT_URL) {
    return takeScreenshotViaHttp({
      baseUrl: env.DEV_SCREENSHOT_URL,
      mode,
      options,
    });
  }
  return takeScreenshotViaBrowser({ env, mode, options });
}

async function takeScreenshotViaHttp({
  baseUrl,
  mode,
  options,
}: {
  baseUrl: string;
  mode: ScreenshotMode;
  options: OGImageOptions;
}): Promise<ArrayBuffer> {
  const res = await fetch(`${baseUrl}/screenshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, options }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Screenshot service error (${res.status}): ${text}`);
  }

  return res.arrayBuffer();
}

async function takeScreenshotViaBrowser({
  env,
  mode,
  options,
}: {
  env: Cloudflare.Env;
  mode: ScreenshotMode;
  options: OGImageOptions;
}): Promise<ArrayBuffer> {
  return renderWithBrowser({ env, mode, options, retryOnBrowserFailure: true });
}

async function renderWithBrowser({
  env,
  mode,
  options,
  retryOnBrowserFailure,
}: {
  env: Cloudflare.Env;
  mode: ScreenshotMode;
  options: OGImageOptions;
  retryOnBrowserFailure: boolean;
}): Promise<ArrayBuffer> {
  const format = options.format;
  const browser = await getBrowser(env);
  let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;

  try {
    page = await browser.newPage();

    await page.setViewport({
      width: OG_WIDTH,
      height: OG_HEIGHT,
      deviceScaleFactor: OG_SCALE,
    });

    const response = await page.goto(mode.url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    if (!response || response.status() >= 400) {
      throw new Error(
        `Page returned ${response?.status() ?? "no response"}: ${mode.url}`,
      );
    }

    // Wait for the page to signal readiness (React hydration + template population)
    // BEFORE extracting the template — the template is populated by a client-side
    // useEffect that runs after hydration.
    try {
      await page.waitForFunction(OG_READY_SIGNAL, { timeout: 25000 });
    } catch {
      await page.evaluate(`new Promise(resolve => {
        let f = 0;
        const w = () => { f++; f < 10 ? requestAnimationFrame(w) : resolve(); };
        requestAnimationFrame(w);
      })`);
    }

    const templateResult = (await page.evaluate(
      OG_TEMPLATE_EXTRACT_SCRIPT,
    )) as { width: number; height: number } | null;

    if (!templateResult) {
      throw new Error(`No OG template found on page: ${mode.url}`);
    }

    await page.setViewport({
      width: templateResult.width,
      height: templateResult.height,
      deviceScaleFactor: 1,
    });

    const img = await page.screenshot({
      type: format,
      ...(format !== "png" && options.quality
        ? { quality: options.quality }
        : {}),
    });
    return new Uint8Array(img).buffer as ArrayBuffer;
  } catch (err) {
    if (retryOnBrowserFailure && isBrowserFailure(err)) {
      await resetBrowser();
      return renderWithBrowser({
        env,
        mode,
        options,
        retryOnBrowserFailure: false,
      });
    }
    throw err;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

async function getBrowser(env: Cloudflare.Env): Promise<Browser> {
  if (sharedBrowser) {
    try {
      await sharedBrowser.version();
      return sharedBrowser;
    } catch {
      sharedBrowser = null;
    }
  }

  if (!browserInit) {
    browserInit = puppeteer.launch(env.BROWSER).then((browser) => {
      sharedBrowser = browser;
      return browser;
    });
  }

  try {
    return await browserInit;
  } finally {
    browserInit = null;
  }
}

async function resetBrowser(): Promise<void> {
  if (!sharedBrowser) return;
  try {
    await sharedBrowser.close();
  } catch {}
  sharedBrowser = null;
}

function isBrowserFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes("disconnected") ||
    message.includes("session closed") ||
    message.includes("target closed")
  );
}
