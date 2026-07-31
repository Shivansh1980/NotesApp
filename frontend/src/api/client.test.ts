import { describe, expect, it } from "vitest";

import { resolveApiUrl } from "./client";

describe("resolveApiUrl", () => {
  it("resolves backend-relative media URLs against the configured API host", () => {
    expect(resolveApiUrl("/uploads/example.png", "https://api.example.com/")).toBe(
      "https://api.example.com/uploads/example.png"
    );
  });

  it("preserves absolute and browser-owned URLs", () => {
    expect(resolveApiUrl("https://cdn.example.com/image.png", "https://api.example.com")).toBe(
      "https://cdn.example.com/image.png"
    );
    expect(resolveApiUrl("data:image/png;base64,abc", "https://api.example.com")).toBe(
      "data:image/png;base64,abc"
    );
    expect(resolveApiUrl("blob:https://app.example.com/id", "https://api.example.com")).toBe(
      "blob:https://app.example.com/id"
    );
  });
});
