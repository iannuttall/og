import type { AppConfig } from "./config";

export interface ValidTarget {
  host: string;
  requestedUrl: string;
  targetUrl: string;
  usedHomepageFallback: boolean;
}

export type TargetResult =
  | { ok: true; target: ValidTarget }
  | { ok: false; status: 400 | 403; error: string };

export function validateTarget(
  rawTargetUrl: string,
  config: AppConfig,
): TargetResult {
  let parsedTarget: URL;
  try {
    parsedTarget = new URL(rawTargetUrl);
  } catch {
    return { ok: false, status: 400, error: "Invalid target URL" };
  }

  if (parsedTarget.protocol !== "https:") {
    return {
      ok: false,
      status: 400,
      error: "Target URL must use HTTPS",
    };
  }

  const host = parsedTarget.hostname.toLowerCase();
  if (!isHostAllowed(host, config.allowedHosts, config.allowSubdomains)) {
    return {
      ok: false,
      status: 403,
      error: `Host "${host}" is not allowlisted`,
    };
  }

  const requestedUrl =
    parsedTarget.origin + parsedTarget.pathname + parsedTarget.search;

  return {
    ok: true,
    target: {
      host,
      requestedUrl,
      targetUrl: requestedUrl,
      usedHomepageFallback: false,
    },
  };
}

function isHostAllowed(
  host: string,
  allowedHosts: string[],
  allowSubdomains: boolean,
): boolean {
  if (allowedHosts.includes("*")) return true;

  for (const allowed of allowedHosts) {
    if (host === allowed) return true;
    if (allowSubdomains && host.endsWith(`.${allowed}`)) return true;
  }
  return false;
}
