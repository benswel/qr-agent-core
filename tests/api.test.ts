import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getApp, getApiKey, closeApp } from "./setup.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let apiKey: string;
let createdShortId: string;

beforeAll(async () => {
  app = await getApp();
  apiKey = getApiKey();
});

afterAll(async () => {
  await closeApp();
});

// ─── Auth ──────────────────────────────────────────────

describe("Authentication", () => {
  it("rejects requests without API key", async () => {
    const res = await app.inject({ method: "GET", url: "/api/qr" });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe("AUTH_MISSING_KEY");
    expect(body.hint).toBeTruthy();
  });

  it("rejects requests with invalid API key", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/qr",
      headers: { "x-api-key": "qr_invalid_key_12345" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("AUTH_INVALID_KEY");
  });

  it("allows public routes without auth", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });

  it("allows .well-known routes without auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/.well-known/ai-plugin.json",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name_for_model).toBe("qr_agent_core");
  });

  it("allows documentation without auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/documentation/json",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toBeTruthy();
  });
});

// ─── QR CRUD ───────────────────────────────────────────

describe("QR Code CRUD", () => {
  it("creates a QR code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: {
        target_url: "https://example.com",
        label: "Test QR",
        format: "svg",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.short_id).toBeTruthy();
    expect(body.short_url).toContain("/r/");
    expect(body.target_url).toBe("https://example.com");
    expect(body.label).toBe("Test QR");
    expect(body.format).toBe("svg");
    expect(body.image_data).toContain("<svg");
    expect(body.created_at).toBeTruthy();

    createdShortId = body.short_id;
  });

  it("creates a PNG QR code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: {
        target_url: "https://example.com/png",
        format: "png",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.format).toBe("png");
    expect(body.image_data).toContain("data:image/png;base64,");
  });

  it("rejects invalid URL", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: { target_url: "not-a-url" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INVALID_URL");
  });

  it("lists QR codes with pagination", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/qr?limit=10&offset=0",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
  });

  it("gets a single QR code", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/qr/${createdShortId}`,
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.short_id).toBe(createdShortId);
    expect(body.target_url).toBe("https://example.com");
  });

  it("returns 404 for non-existent QR code", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/qr/nonexistent123",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("RESOURCE_NOT_FOUND");
    expect(res.json().hint).toContain("nonexistent123");
  });

  it("updates target URL (dynamic link)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/qr/${createdShortId}`,
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: {
        target_url: "https://new-destination.com",
        label: "Updated label",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.target_url).toBe("https://new-destination.com");
    expect(body.label).toBe("Updated label");
    expect(body.short_id).toBe(createdShortId);
  });

  it("rejects update with invalid URL", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/qr/${createdShortId}`,
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: { target_url: "bad-url" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INVALID_URL");
  });
});

// ─── Redirect + Analytics ──────────────────────────────

describe("Redirect & Analytics", () => {
  it("redirects short URL to target (no auth needed)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${createdShortId}`,
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://new-destination.com");
  });

  it("returns 404 for non-existent short URL", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/r/doesnotexist",
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("RESOURCE_NOT_FOUND");
  });

  it("records scan and returns analytics", async () => {
    // Hit the redirect a few more times
    await app.inject({ method: "GET", url: `/r/${createdShortId}` });
    await app.inject({ method: "GET", url: `/r/${createdShortId}` });

    const res = await app.inject({
      method: "GET",
      url: `/api/analytics/${createdShortId}`,
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.short_id).toBe(createdShortId);
    expect(body.total_scans).toBeGreaterThanOrEqual(3); // 1 from redirect test + 2 here
    expect(body.recent_scans).toBeInstanceOf(Array);
    expect(body.recent_scans.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── Image Endpoints ───────────────────────────────────

describe("Image Endpoints", () => {
  it("serves SVG image via authenticated endpoint", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/qr/${createdShortId}/image`,
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    expect(res.body).toContain("<svg");
  });

  it("serves PNG image via format override", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/qr/${createdShortId}/image?format=png`,
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
    expect(res.rawPayload.length).toBeGreaterThan(100);
  });

  it("rejects image endpoint without auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/qr/${createdShortId}/image`,
    });

    expect(res.statusCode).toBe(401);
  });

  it("serves SVG image via public /i/ endpoint (no auth)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/i/${createdShortId}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    expect(res.headers["cache-control"]).toContain("max-age=300");
    expect(res.body).toContain("<svg");
  });

  it("serves PNG via public /i/ endpoint with format override", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/i/${createdShortId}?format=png`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
  });

  it("returns 404 for non-existent image", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/i/doesnotexist",
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── Delete ────────────────────────────────────────────

describe("QR Code Deletion", () => {
  it("deletes a QR code", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/qr/${createdShortId}`,
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().deleted).toBe(true);
  });

  it("redirect stops working after deletion", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${createdShortId}`,
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when deleting non-existent QR code", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/qr/${createdShortId}`,
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(404);
  });
});
