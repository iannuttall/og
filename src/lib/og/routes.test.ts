import { describe, expect, it } from "vitest";
import { shouldRedirectRoot } from "./routes";

describe("routes", () => {
  it("redirects plain root visits", () => {
    expect(shouldRedirectRoot(new URL("https://og.example.com/"))).toBe(true);
  });

  it("keeps root render requests on the image endpoint", () => {
    expect(
      shouldRedirectRoot(
        new URL("https://og.example.com/?url=https%3A%2F%2Fexample.com"),
      ),
    ).toBe(false);
  });
});
