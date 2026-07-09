import { extractUrlParam } from "./utils";

export function shouldRedirectRoot(url: URL): boolean {
  return url.pathname === "/" && !extractUrlParam(url);
}
