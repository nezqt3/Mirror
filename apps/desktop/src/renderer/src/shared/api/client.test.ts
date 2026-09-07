import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client.js";

describe("ApiClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes FastAPI validation errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      detail: [{ loc: ["body", "email"], msg: "value is not a valid email address" }]
    }), {
      status: 422,
      headers: { "Content-Type": "application/json" }
    })));

    const request = new ApiClient("http://api.test").request("/users", {
      method: "POST",
      body: {},
      auth: false
    });

    await expect(request).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
      fieldErrors: { email: "value is not a valid email address" }
    });
  });

  it("turns connection failures into a consistent ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(new ApiClient("http://api.test").request("/health", { auth: false }))
      .rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });
});
