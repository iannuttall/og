import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";
import { validateTarget } from "./target";

describe("target validation", () => {
  it("requires https targets", () => {
    const config = loadConfig({
      ALLOWED_HOSTS: "example.com",
    } as Cloudflare.Env);

    expect(validateTarget("http://example.com", config)).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("allows exact hosts", () => {
    const config = loadConfig({
      ALLOWED_HOSTS: "example.com",
      ALLOW_SUBDOMAINS: "false",
    } as Cloudflare.Env);

    expect(validateTarget("https://example.com/post", config)).toMatchObject({
      ok: true,
    });
  });

  it("blocks subdomains unless enabled", () => {
    const config = loadConfig({
      ALLOWED_HOSTS: "example.com",
      ALLOW_SUBDOMAINS: "false",
    } as Cloudflare.Env);

    expect(
      validateTarget("https://blog.example.com/post", config),
    ).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("allows subdomains when enabled", () => {
    const config = loadConfig({
      ALLOWED_HOSTS: "example.com",
      ALLOW_SUBDOMAINS: "true",
    } as Cloudflare.Env);

    expect(
      validateTarget("https://blog.example.com/post", config),
    ).toMatchObject({
      ok: true,
    });
  });
});
