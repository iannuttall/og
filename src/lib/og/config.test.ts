import { describe, expect, it } from "vitest";
import { assertConfigSafe, loadConfig, parseOptions } from "./config";

describe("config", () => {
  it("rejects wildcard hosts outside development", () => {
    const config = loadConfig({
      ALLOWED_HOSTS: "*",
      ENVIRONMENT: "production",
    } as Cloudflare.Env);

    expect(assertConfigSafe(config)).toContain("wildcard");
  });

  it("allows wildcard hosts in development", () => {
    const config = loadConfig({
      ALLOWED_HOSTS: "*",
      ENVIRONMENT: "development",
    } as Cloudflare.Env);

    expect(assertConfigSafe(config)).toBeNull();
  });

  it("rejects unsupported formats by config", () => {
    const config = loadConfig({
      ALLOWED_HOSTS: "example.com",
      ALLOWED_FORMATS: "png",
      ENVIRONMENT: "production",
    } as Cloudflare.Env);
    const options = parseOptions(new URLSearchParams("format=webp"), config);

    expect(options).toEqual({
      error: 'Format "webp" is not allowed by this worker',
    });
  });

  it("caps public cacheTtl at the configured max", () => {
    const config = loadConfig({
      ALLOWED_HOSTS: "example.com",
      CACHE_TTL_SECONDS: "300",
      ENVIRONMENT: "production",
    } as unknown as Cloudflare.Env);
    const options = parseOptions(
      new URLSearchParams("cacheTtl=31536000"),
      config,
    );

    expect("error" in options).toBe(false);
    if (!("error" in options)) {
      expect(options.cacheTtl).toBe(300);
    }
  });
});
