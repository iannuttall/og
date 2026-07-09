import { describe, expect, it } from "vitest";
import { cacheKey, extractUrlParam } from "./utils";

const options = {
  format: "png" as const,
  cacheTtl: 3600,
};

describe("utils", () => {
  it("preserves query strings in encoded target URLs", () => {
    const url = new URL(
      "https://og.test/?url=https%3A%2F%2Fexample.com%2Fpost%3Fa%3D1%26b%3D2",
    );

    expect(extractUrlParam(url)).toBe("https://example.com/post?a=1&b=2");
  });

  it("ignores public v params for cache identity", async () => {
    const mode = { mode: "url" as const, url: "https://example.com/post" };

    const one = await cacheKey(mode, options, "0");
    const two = await cacheKey(mode, options, "0");

    expect(one).toBe(two);
  });

  it("still changes cache identity when owner purge version changes", async () => {
    const mode = { mode: "url" as const, url: "https://example.com/post" };

    const one = await cacheKey(mode, options, "0");
    const two = await cacheKey(mode, options, "owner-version");

    expect(one).not.toBe(two);
  });
});
