import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, request } from "./api-client";

describe("web API client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("turns an HTML proxy failure into a safe actionable error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>bad gateway</html>", {
      status: 502,
      headers: { "content-type": "text/html" },
    })));

    await expect(request("/api", "/purchase-orders")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 502,
      retryable: true,
      message: "The Nischit service is temporarily unavailable. Try again shortly.",
    } satisfies Partial<ApiRequestError>);
  });

  it("preserves tenant context, JSON payload, and idempotency on commands", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "po-1" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request<{ id: string }>("/api", "/purchase-orders", {
      session: { tenantId: "tenant-a", userId: "user-a" },
      body: { quantity: 2 },
      idempotencyKey: "web-po-1",
    })).resolves.toEqual({ id: "po-1" });

    expect(fetchMock).toHaveBeenCalledWith("/api/purchase-orders", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ quantity: 2 }),
      headers: expect.objectContaining({
        "x-tenant-id": "tenant-a",
        "x-user-id": "user-a",
        "idempotency-key": "web-po-1",
        "content-type": "application/json",
      }),
    }));
  });

  it("does not send spoofable tenant headers for a verified browser session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await request("/api", "/session", { session: { tenantId: "tenant-a", userId: "user-a", kind: "verified" } });

    expect(fetchMock).toHaveBeenCalledWith("/api/session", expect.objectContaining({
      credentials: "include",
      headers: expect.not.objectContaining({ "x-tenant-id": expect.anything(), "x-user-id": expect.anything() }),
    }));
  });
});
