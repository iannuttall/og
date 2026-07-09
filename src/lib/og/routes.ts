import { extractUrlParam } from "./utils";

export const REPOSITORY_URL = "https://github.com/iannuttall/og";

export function shouldRedirectRoot(url: URL): boolean {
  return url.pathname === "/" && !extractUrlParam(url);
}
