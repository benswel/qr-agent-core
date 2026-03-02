import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getApp, getApiKey, getApiKey2, getFreeApiKey, closeApp } from "./setup.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let apiKey: string;
let apiKey2: string;
let freeApiKey: string;
let createdShortId: string;

beforeAll(async () => {
  app = await getApp();
  apiKey = getApiKey();
  apiKey2 = getApiKey2();
  freeApiKey = getFreeApiKey();
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

  it("records scan and returns enriched analytics", async () => {
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
    expect(body.total_scans).toBeGreaterThanOrEqual(3);
    expect(body.period).toBe("30d");
    expect(body.recent_scans).toBeInstanceOf(Array);
    expect(body.recent_scans.length).toBeGreaterThanOrEqual(3);
    // Enriched fields exist
    expect(body).toHaveProperty("scans_by_day");
    expect(body).toHaveProperty("top_devices");
    expect(body).toHaveProperty("top_browsers");
    expect(body).toHaveProperty("top_countries");
    expect(body).toHaveProperty("top_referers");
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

// ─── Multi-Tenant Isolation ────────────────────────────

describe("Multi-Tenant Isolation", () => {
  let key1ShortId: string;
  let key2ShortId: string;

  it("key1 creates a QR code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: { target_url: "https://tenant1.com", label: "Tenant 1 QR" },
    });

    expect(res.statusCode).toBe(201);
    key1ShortId = res.json().short_id;
  });

  it("key2 creates a QR code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey2, "content-type": "application/json" },
      payload: { target_url: "https://tenant2.com", label: "Tenant 2 QR" },
    });

    expect(res.statusCode).toBe(201);
    key2ShortId = res.json().short_id;
  });

  it("key1 can see its own QR code", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/qr/${key1ShortId}`,
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().short_id).toBe(key1ShortId);
  });

  it("key2 cannot see key1's QR code", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/qr/${key1ShortId}`,
      headers: { "x-api-key": apiKey2 },
    });

    expect(res.statusCode).toBe(404);
  });

  it("key1 cannot see key2's QR code", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/qr/${key2ShortId}`,
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(404);
  });

  it("key2 cannot update key1's QR code", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/qr/${key1ShortId}`,
      headers: { "x-api-key": apiKey2, "content-type": "application/json" },
      payload: { target_url: "https://hacked.com" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("key2 cannot delete key1's QR code", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/qr/${key1ShortId}`,
      headers: { "x-api-key": apiKey2 },
    });

    expect(res.statusCode).toBe(404);
  });

  it("key2 cannot access key1's analytics", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analytics/${key1ShortId}`,
      headers: { "x-api-key": apiKey2 },
    });

    expect(res.statusCode).toBe(404);
  });

  it("key2 cannot access key1's image via authenticated endpoint", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/qr/${key1ShortId}/image`,
      headers: { "x-api-key": apiKey2 },
    });

    expect(res.statusCode).toBe(404);
  });

  it("list only shows own QR codes", async () => {
    const res1 = await app.inject({
      method: "GET",
      url: "/api/qr",
      headers: { "x-api-key": apiKey2 },
    });

    expect(res1.statusCode).toBe(200);
    const body = res1.json();
    // key2 should only see its own QR codes
    const shortIds = body.data.map((qr: { short_id: string }) => qr.short_id);
    expect(shortIds).toContain(key2ShortId);
    expect(shortIds).not.toContain(key1ShortId);
  });

  it("public redirect still works for any QR code (no auth)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${key1ShortId}`,
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://tenant1.com");
  });

  it("public image still works for any QR code (no auth)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/i/${key1ShortId}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
  });
});

// ─── Custom QR Styling ────────────────────────────────

describe("Custom QR Code Styling", () => {
  it("creates QR with custom colors", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: {
        target_url: "https://styled.com",
        foreground_color: "#4F46E5",
        background_color: "#F9FAFB",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.image_data).toContain("<svg");
    expect(body.image_data).toContain("#4F46E5");
    expect(body.image_data).toContain("#F9FAFB");
  });

  it("creates QR with rounded dots", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: {
        target_url: "https://rounded.com",
        dot_style: "rounded",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.image_data).toContain("<svg");
    // Rounded dots use rx attribute
    expect(body.image_data).toContain("rx=");
  });

  it("creates QR with dot circles", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: {
        target_url: "https://dots.com",
        dot_style: "dots",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.image_data).toContain("<circle");
  });

  it("creates QR with circular corner style", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: {
        target_url: "https://dotcorners.com",
        corner_style: "dot",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    // Dot corners render as <circle>
    expect(body.image_data).toContain("<circle");
  });

  it("creates QR with custom width", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: {
        target_url: "https://bigqr.com",
        width: 800,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.image_data).toContain('width="800"');
    expect(body.image_data).toContain('height="800"');
  });

  it("creates styled PNG QR code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: {
        target_url: "https://styledpng.com",
        format: "png",
        foreground_color: "#FF0000",
        dot_style: "rounded",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.format).toBe("png");
    expect(body.image_data).toContain("data:image/png;base64,");
  });

  it("backward compatible — no style options works", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: { target_url: "https://classic.com" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.image_data).toContain("<svg");
    expect(body.short_id).toBeTruthy();
  });

  it("regenerates styled QR at /i/ endpoint", async () => {
    // Create a styled QR first
    const createRes = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: {
        target_url: "https://regen.com",
        foreground_color: "#10B981",
        dot_style: "dots",
      },
    });

    const shortId = createRes.json().short_id;

    // Fetch via public /i/ endpoint
    const imgRes = await app.inject({
      method: "GET",
      url: `/i/${shortId}`,
    });

    expect(imgRes.statusCode).toBe(200);
    expect(imgRes.body).toContain("#10B981");
    expect(imgRes.body).toContain("<circle");
  });
});

// ─── Webhooks ─────────────────────────────────────────

describe("Webhooks CRUD", () => {
  let webhookId: number;

  it("creates a webhook", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/webhooks",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: {
        url: "https://example.com/webhook",
        events: ["qr.scanned"],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeTruthy();
    expect(body.url).toBe("https://example.com/webhook");
    expect(body.secret).toBeTruthy();
    expect(body.secret.length).toBe(32);
    expect(body.events).toEqual(["qr.scanned"]);
    expect(body.is_active).toBe(true);
    expect(body.created_at).toBeTruthy();

    webhookId = body.id;
  });

  it("creates webhook with default events", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/webhooks",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: { url: "https://example.com/webhook2" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().events).toEqual(["qr.scanned"]);
  });

  it("rejects invalid webhook URL", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/webhooks",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: { url: "not-a-url" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INVALID_WEBHOOK_URL");
  });

  it("lists webhooks", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/webhooks",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.total).toBeGreaterThanOrEqual(1);
    // Secret should NOT be in list response
    expect(body.data[0].secret).toBeUndefined();
  });

  it("deletes a webhook", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/webhooks/${webhookId}`,
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().deleted).toBe(true);
  });

  it("returns 404 for non-existent webhook", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/webhooks/99999",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("WEBHOOK_NOT_FOUND");
  });
});

describe("Webhook Multi-Tenant Isolation", () => {
  let key1WebhookId: number;

  it("key1 creates a webhook", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/webhooks",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: { url: "https://tenant1.com/hook" },
    });

    expect(res.statusCode).toBe(201);
    key1WebhookId = res.json().id;
  });

  it("key2 cannot see key1's webhooks", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/webhooks",
      headers: { "x-api-key": apiKey2 },
    });

    expect(res.statusCode).toBe(200);
    const ids = res.json().data.map((w: { id: number }) => w.id);
    expect(ids).not.toContain(key1WebhookId);
  });

  it("key2 cannot delete key1's webhook", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/webhooks/${key1WebhookId}`,
      headers: { "x-api-key": apiKey2 },
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

// ─── Free Tier Quota Limits ─────────────────────────────

describe("Free Tier QR Code Limit", () => {
  it("allows creating up to 10 QR codes", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/qr",
        headers: { "x-api-key": freeApiKey, "content-type": "application/json" },
        payload: { target_url: `https://free-test-${i}.com` },
      });
      expect(res.statusCode).toBe(201);
    }
  });

  it("rejects the 11th QR code with QR_CODE_LIMIT_REACHED", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": freeApiKey, "content-type": "application/json" },
      payload: { target_url: "https://free-test-11.com" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("QR_CODE_LIMIT_REACHED");
    expect(res.json().hint).toContain("10");
  });

  it("allows creation again after deleting a QR code", async () => {
    // Get list to find a shortId to delete
    const listRes = await app.inject({
      method: "GET",
      url: "/api/qr",
      headers: { "x-api-key": freeApiKey },
    });
    const shortId = listRes.json().data[0].short_id;

    // Delete one
    await app.inject({
      method: "DELETE",
      url: `/api/qr/${shortId}`,
      headers: { "x-api-key": freeApiKey },
    });

    // Now we should be able to create again
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": freeApiKey, "content-type": "application/json" },
      payload: { target_url: "https://free-test-replacement.com" },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe("Free Tier Webhook Limit", () => {
  it("allows creating 1 webhook", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/webhooks",
      headers: { "x-api-key": freeApiKey, "content-type": "application/json" },
      payload: { url: "https://free-webhook.com/hook" },
    });

    expect(res.statusCode).toBe(201);
  });

  it("rejects the 2nd webhook with WEBHOOK_LIMIT_REACHED", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/webhooks",
      headers: { "x-api-key": freeApiKey, "content-type": "application/json" },
      payload: { url: "https://free-webhook2.com/hook" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("WEBHOOK_LIMIT_REACHED");
    expect(res.json().hint).toContain("1");
  });
});

describe("Pro Tier Has No Limits", () => {
  it("pro key can create more than 10 QR codes", async () => {
    // apiKey is pro — it already has many QR codes from other tests
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: { target_url: "https://pro-unlimited.com" },
    });

    expect(res.statusCode).toBe(201);
  });

  it("pro key can create multiple webhooks", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/webhooks",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      payload: { url: "https://pro-webhook-extra.com/hook" },
    });

    expect(res.statusCode).toBe(201);
  });
});

describe("Usage Endpoint", () => {
  it("returns usage for free tier key", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/usage",
      headers: { "x-api-key": freeApiKey },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.plan).toBe("free");
    expect(body.qr_codes.used).toBe(10);
    expect(body.qr_codes.limit).toBe(10);
    expect(body.scans_this_month.limit).toBe(1000);
    expect(body.webhooks.used).toBe(1);
    expect(body.webhooks.limit).toBe(1);
  });

  it("returns usage for pro tier key", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/usage",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.plan).toBe("pro");
    expect(body.qr_codes.limit).toBeNull();
    expect(body.scans_this_month.limit).toBeNull();
    expect(body.webhooks.limit).toBeNull();
  });

  it("requires authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/usage",
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("Scan Limit — Redirect Always Works", () => {
  let freeQrShortId: string;

  it("redirect works even for free tier QR codes", async () => {
    // Get a free tier QR code shortId
    const listRes = await app.inject({
      method: "GET",
      url: "/api/qr",
      headers: { "x-api-key": freeApiKey },
    });
    freeQrShortId = listRes.json().data[0].short_id;

    const res = await app.inject({
      method: "GET",
      url: `/r/${freeQrShortId}`,
    });

    expect(res.statusCode).toBe(302);
  });
});

// ============================================================
// Bulk Operations
// ============================================================

describe("Bulk Create", () => {
  it("should create multiple QR codes at once", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr/bulk",
      headers: { "x-api-key": apiKey },
      payload: {
        items: [
          { target_url: "https://bulk1.example.com", label: "Bulk 1" },
          { target_url: "https://bulk2.example.com", label: "Bulk 2" },
          { target_url: "https://bulk3.example.com", label: "Bulk 3" },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.created).toBe(3);
    expect(body.items).toHaveLength(3);
    expect(body.items[0]).toHaveProperty("short_id");
    expect(body.items[0]).toHaveProperty("image_data");
    expect(body.items[0].target_url).toBe("https://bulk1.example.com");
  });

  it("should reject empty items array", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr/bulk",
      headers: { "x-api-key": apiKey },
      payload: { items: [] },
    });

    expect(res.statusCode).toBe(400);
  });

  it("should enforce quota on free plan", async () => {
    // freeApiKey has maxQrCodes=10, create 11 to exceed
    const items = Array.from({ length: 11 }, (_, i) => ({
      target_url: `https://free-bulk-${i}.example.com`,
    }));

    const res = await app.inject({
      method: "POST",
      url: "/api/qr/bulk",
      headers: { "x-api-key": freeApiKey },
      payload: { items },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("QR_CODE_LIMIT_REACHED");
  });
});

let bulkShortIds: string[] = [];

describe("Bulk Update", () => {
  it("should update multiple QR codes at once", async () => {
    // First create some QR codes to update
    const createRes = await app.inject({
      method: "POST",
      url: "/api/qr/bulk",
      headers: { "x-api-key": apiKey },
      payload: {
        items: [
          { target_url: "https://update1.example.com" },
          { target_url: "https://update2.example.com" },
        ],
      },
    });
    bulkShortIds = createRes.json().items.map((i: any) => i.short_id);

    const res = await app.inject({
      method: "PATCH",
      url: "/api/qr/bulk",
      headers: { "x-api-key": apiKey },
      payload: {
        items: [
          { short_id: bulkShortIds[0], target_url: "https://updated1.example.com" },
          { short_id: bulkShortIds[1], label: "Updated Label" },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.updated).toBe(2);
    expect(body.not_found).toBe(0);
  });

  it("should report not_found for invalid short_ids", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/qr/bulk",
      headers: { "x-api-key": apiKey },
      payload: {
        items: [
          { short_id: "nonexistent", target_url: "https://nope.com" },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().not_found).toBe(1);
    expect(res.json().items[0].status).toBe("not_found");
  });
});

describe("Bulk Delete", () => {
  it("should delete multiple QR codes at once", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/qr/bulk",
      headers: { "x-api-key": apiKey },
      payload: { short_ids: bulkShortIds },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.deleted).toBe(2);
    expect(body.not_found).toBe(0);
  });

  it("should report not_found for invalid short_ids", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/qr/bulk",
      headers: { "x-api-key": apiKey },
      payload: { short_ids: ["nonexistent1", "nonexistent2"] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().deleted).toBe(0);
    expect(res.json().not_found).toBe(2);
  });
});

// ============================================================
// Admin Endpoints
// ============================================================

describe("Admin Endpoints", () => {
  it("should reject requests without admin secret", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/keys",
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ADMIN_FORBIDDEN");
  });

  it("should reject requests with wrong admin secret", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/keys",
      headers: { "x-admin-secret": "wrong-secret" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("should list API keys with correct admin secret", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/keys",
      headers: { "x-admin-secret": "test-admin-secret" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBeGreaterThanOrEqual(3); // test-agent, test-agent-2, test-free-agent
    expect(body.keys[0]).toHaveProperty("email");
    expect(body.keys[0]).toHaveProperty("plan");
    expect(body.keys[0]).not.toHaveProperty("key"); // key should not be exposed
  });

  it("should return dashboard stats with correct admin secret", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/stats",
      headers: { "x-admin-secret": "test-admin-secret" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.users.total).toBeGreaterThanOrEqual(3);
    expect(body.users.by_plan).toHaveProperty("free");
    expect(body.users).toHaveProperty("signups_last_7d");
    expect(body.users).toHaveProperty("active_last_7d");
    expect(body.qr_codes).toHaveProperty("total");
    expect(body.scans).toHaveProperty("total");
    expect(body.scans).toHaveProperty("last_30d");
    expect(body.webhooks).toHaveProperty("total");
    expect(body.webhooks).toHaveProperty("deliveries_last_30d");
  });

  it("should reject stats without admin secret", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/stats",
    });

    expect(res.statusCode).toBe(403);
  });

});

// ─── Expiration & Scheduling ──────────────────────────

describe("Expiration & Scheduling", () => {
  it("should return 410 for expired QR codes", async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString(); // 1 minute ago
    const createRes = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        target_url: "https://expired-promo.example.com",
        label: "Expired promo",
        expires_at: pastDate,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { short_id } = createRes.json();

    const redirectRes = await app.inject({
      method: "GET",
      url: `/r/${short_id}`,
    });
    expect(redirectRes.statusCode).toBe(410);
    const body = redirectRes.json();
    expect(body.code).toBe("QR_EXPIRED");
    expect(body.expired_at).toBe(pastDate);
  });

  it("should redirect normally for non-expired QR codes", async () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString(); // +24h
    const createRes = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        target_url: "https://active-promo.example.com",
        expires_at: futureDate,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { short_id } = createRes.json();

    const redirectRes = await app.inject({
      method: "GET",
      url: `/r/${short_id}`,
    });
    expect(redirectRes.statusCode).toBe(302);
    expect(redirectRes.headers.location).toBe("https://active-promo.example.com");
  });

  it("should set and clear expires_at via PATCH", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: { target_url: "https://patch-expiry.example.com" },
    });
    const { short_id } = createRes.json();

    // Set expiration
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/qr/${short_id}`,
      headers: { "x-api-key": apiKey },
      payload: { expires_at: futureDate },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().expires_at).toBe(futureDate);

    // Clear expiration
    const clearRes = await app.inject({
      method: "PATCH",
      url: `/api/qr/${short_id}`,
      headers: { "x-api-key": apiKey },
      payload: { expires_at: null },
    });
    expect(clearRes.statusCode).toBe(200);
    expect(clearRes.json().expires_at).toBeNull();
  });

  it("should swap URL lazily when scheduled_at is in the past", async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    const createRes = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        target_url: "https://original-url.example.com",
        scheduled_url: "https://new-url.example.com",
        scheduled_at: pastDate,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { short_id } = createRes.json();

    // First scan triggers the swap
    const redirectRes = await app.inject({
      method: "GET",
      url: `/r/${short_id}`,
    });
    expect(redirectRes.statusCode).toBe(302);
    expect(redirectRes.headers.location).toBe("https://new-url.example.com");

    // Verify swap persisted in DB
    const getRes = await app.inject({
      method: "GET",
      url: `/api/qr/${short_id}`,
      headers: { "x-api-key": apiKey },
    });
    const qr = getRes.json();
    expect(qr.target_url).toBe("https://new-url.example.com");
    expect(qr.scheduled_url).toBeNull();
    expect(qr.scheduled_at).toBeNull();
  });

  it("should NOT swap URL when scheduled_at is in the future", async () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    const createRes = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        target_url: "https://current-url.example.com",
        scheduled_url: "https://future-url.example.com",
        scheduled_at: futureDate,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { short_id } = createRes.json();

    const redirectRes = await app.inject({
      method: "GET",
      url: `/r/${short_id}`,
    });
    expect(redirectRes.statusCode).toBe(302);
    expect(redirectRes.headers.location).toBe("https://current-url.example.com");
  });

  it("should return scheduling fields in create response", async () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    const createRes = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        target_url: "https://fields-test.example.com",
        expires_at: futureDate,
        scheduled_url: "https://scheduled-test.example.com",
        scheduled_at: futureDate,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const body = createRes.json();
    expect(body.expires_at).toBe(futureDate);
    expect(body.scheduled_url).toBe("https://scheduled-test.example.com");
    expect(body.scheduled_at).toBe(futureDate);
  });

  it("should prioritize expiration over scheduled swap", async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    const createRes = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        target_url: "https://expired-with-swap.example.com",
        expires_at: pastDate,
        scheduled_url: "https://should-not-reach.example.com",
        scheduled_at: pastDate,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { short_id } = createRes.json();

    const redirectRes = await app.inject({
      method: "GET",
      url: `/r/${short_id}`,
    });
    // Should be 410 (expired), NOT a redirect to scheduled_url
    expect(redirectRes.statusCode).toBe(410);
    expect(redirectRes.json().code).toBe("QR_EXPIRED");
  });
});

// ─── Enriched Analytics ─────────────────────────────────

describe("Enriched Analytics", () => {
  let analyticsShortId: string;

  it("should create QR and simulate scans with different user-agents", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: { target_url: "https://analytics-enriched-test.example.com" },
    });
    expect(createRes.statusCode).toBe(201);
    analyticsShortId = createRes.json().short_id;

    // Scan 1: Chrome on desktop (no device type → defaults to "desktop")
    await app.inject({
      method: "GET",
      url: `/r/${analyticsShortId}`,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        referer: "https://instagram.com/p/abc123",
      },
    });

    // Scan 2: Safari on iPhone
    await app.inject({
      method: "GET",
      url: `/r/${analyticsShortId}`,
      headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        referer: "https://facebook.com/posts/xyz",
      },
    });

    // Scan 3: Firefox on Android
    await app.inject({
      method: "GET",
      url: `/r/${analyticsShortId}`,
      headers: {
        "user-agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Firefox/120.0",
      },
    });

    // Scan 4: No user-agent (direct scan)
    await app.inject({
      method: "GET",
      url: `/r/${analyticsShortId}`,
    });
  });

  it("should return enriched recent_scans with device_type, browser, os", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analytics/${analyticsShortId}`,
      headers: { "x-api-key": apiKey },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.recent_scans.length).toBe(4);
    // All recent scans should have enriched fields
    for (const scan of body.recent_scans) {
      expect(scan).toHaveProperty("device_type");
      expect(scan).toHaveProperty("browser");
      expect(scan).toHaveProperty("os");
      expect(scan).toHaveProperty("country");
      expect(scan).toHaveProperty("city");
    }

    // The Chrome desktop scan should have parsed fields
    const chromeScan = body.recent_scans.find((s: any) => s.browser === "Chrome" && s.device_type === "desktop");
    expect(chromeScan).toBeTruthy();

    // The Safari mobile scan should be detected
    const safariScan = body.recent_scans.find((s: any) => s.browser === "Mobile Safari" && s.device_type === "mobile");
    expect(safariScan).toBeTruthy();
  });

  it("should return top_devices with count and percentage", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analytics/${analyticsShortId}`,
      headers: { "x-api-key": apiKey },
    });
    const body = res.json();

    expect(body.top_devices).toBeInstanceOf(Array);
    expect(body.top_devices.length).toBeGreaterThanOrEqual(1);
    for (const device of body.top_devices) {
      expect(device).toHaveProperty("device_type");
      expect(device).toHaveProperty("count");
      expect(device).toHaveProperty("percentage");
      expect(typeof device.percentage).toBe("number");
    }
  });

  it("should return top_browsers with count and percentage", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analytics/${analyticsShortId}`,
      headers: { "x-api-key": apiKey },
    });
    const body = res.json();

    expect(body.top_browsers).toBeInstanceOf(Array);
    expect(body.top_browsers.length).toBeGreaterThanOrEqual(1);
    for (const browser of body.top_browsers) {
      expect(browser).toHaveProperty("browser");
      expect(browser).toHaveProperty("count");
      expect(browser).toHaveProperty("percentage");
    }
  });

  it("should return scans_by_day with date and count", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analytics/${analyticsShortId}`,
      headers: { "x-api-key": apiKey },
    });
    const body = res.json();

    expect(body.scans_by_day).toBeInstanceOf(Array);
    expect(body.scans_by_day.length).toBeGreaterThanOrEqual(1);
    for (const day of body.scans_by_day) {
      expect(day).toHaveProperty("date");
      expect(day).toHaveProperty("count");
      // Date should be YYYY-MM-DD format
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("should include (direct) in top_referers for scans without referer", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analytics/${analyticsShortId}`,
      headers: { "x-api-key": apiKey },
    });
    const body = res.json();

    expect(body.top_referers).toBeInstanceOf(Array);
    const directEntry = body.top_referers.find((r: any) => r.referer === "(direct)");
    expect(directEntry).toBeTruthy();
    expect(directEntry.count).toBeGreaterThanOrEqual(1);

    // Should also have domain-grouped referers
    const instagramEntry = body.top_referers.find((r: any) => r.referer === "instagram.com");
    expect(instagramEntry).toBeTruthy();
  });

  it("should support period=7d querystring", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analytics/${analyticsShortId}?period=7d`,
      headers: { "x-api-key": apiKey },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.period).toBe("7d");
    expect(body.total_scans).toBeGreaterThanOrEqual(4);
    expect(body.scans_by_day).toBeInstanceOf(Array);
  });

  it("should have null country/city for localhost IPs", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analytics/${analyticsShortId}`,
      headers: { "x-api-key": apiKey },
    });
    const body = res.json();

    // All scans are from 127.0.0.1 in tests, so geo should be null
    for (const scan of body.recent_scans) {
      expect(scan.country).toBeNull();
      expect(scan.city).toBeNull();
    }
    // top_countries should be empty (no geo data from localhost)
    expect(body.top_countries).toEqual([]);
  });
});

// ─── vCard QR Codes ─────────────────────────────────────

describe("vCard QR Codes", () => {
  let vcardShortId: string;

  it("should create a vCard QR code with required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "vcard",
        vcard_data: { first_name: "Jean", last_name: "Dupont" },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    vcardShortId = body.short_id;
    expect(body.type).toBe("vcard");
    expect(body.vcard_data).toEqual({ first_name: "Jean", last_name: "Dupont" });
    expect(body.target_url).toBeNull();
    expect(body.image_data).toContain("<svg"); // QR image encodes vCard data as visual modules
  });

  it("should create a vCard QR code with all fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "vcard",
        vcard_data: {
          first_name: "Marie",
          last_name: "Martin",
          organization: "Acme Inc",
          title: "CEO",
          email: "marie@acme.com",
          phone: "+33612345678",
          url: "https://acme.com",
          address: "123 Rue de Rivoli, Paris",
          note: "VIP client",
        },
        label: "Marie business card",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.vcard_data.organization).toBe("Acme Inc");
    expect(body.vcard_data.email).toBe("marie@acme.com");
    expect(body.label).toBe("Marie business card");
  });

  it("should reject vCard without first_name or last_name", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "vcard",
        vcard_data: { first_name: "Orphan" },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("MISSING_REQUIRED_FIELD");
  });

  it("should return type=vcard in GET response", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/qr/${vcardShortId}`,
      headers: { "x-api-key": apiKey },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.type).toBe("vcard");
    expect(body.vcard_data.first_name).toBe("Jean");
    expect(body.vcard_data.last_name).toBe("Dupont");
  });

  it("should list vCard QR codes with type field", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/qr?limit=100",
      headers: { "x-api-key": apiKey },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const vcardItem = body.data.find((item: any) => item.short_id === vcardShortId);
    expect(vcardItem).toBeTruthy();
    expect(vcardItem.type).toBe("vcard");
  });

  it("should update vcard_data via PATCH (partial merge)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/qr/${vcardShortId}`,
      headers: { "x-api-key": apiKey },
      payload: {
        vcard_data: { email: "jean@dupont.fr", phone: "+33600000000" },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.vcard_data.first_name).toBe("Jean"); // preserved
    expect(body.vcard_data.email).toBe("jean@dupont.fr"); // added
    expect(body.vcard_data.phone).toBe("+33600000000"); // added
  });

  it("should serve .vcf file on GET /r/:shortId for vCard type", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${vcardShortId}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/vcard");
    expect(res.headers["content-disposition"]).toContain(".vcf");
    expect(res.body).toContain("BEGIN:VCARD");
    expect(res.body).toContain("Jean");
    expect(res.body).toContain("Dupont");
  });

  it("should return QR image on GET /i/:shortId for vCard type", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/i/${vcardShortId}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    expect(res.body).toContain("<svg");
  });
});

// ─── WiFi QR Codes ──────────────────────────────────────

describe("WiFi QR Codes", () => {
  let wifiShortId: string;

  it("should create a WiFi QR code with WPA encryption", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "wifi",
        wifi_data: { ssid: "MyNetwork", password: "secret123", encryption: "WPA" },
        label: "Office WiFi",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    wifiShortId = body.short_id;
    expect(body.type).toBe("wifi");
    expect(body.wifi_data.ssid).toBe("MyNetwork");
    expect(body.wifi_data.encryption).toBe("WPA");
    expect(body.image_data).toContain("<svg"); // QR image encodes WiFi data as visual modules
  });

  it("should create a WiFi QR code with nopass encryption", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "wifi",
        wifi_data: { ssid: "GuestNet", encryption: "nopass" },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.wifi_data.encryption).toBe("nopass");
  });

  it("should reject WiFi without ssid", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "wifi",
        wifi_data: { password: "noname" },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("MISSING_REQUIRED_FIELD");
  });

  it("should return type=wifi in GET response", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/qr/${wifiShortId}`,
      headers: { "x-api-key": apiKey },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.type).toBe("wifi");
    expect(body.wifi_data.ssid).toBe("MyNetwork");
  });

  it("should update wifi_data via PATCH", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/qr/${wifiShortId}`,
      headers: { "x-api-key": apiKey },
      payload: {
        wifi_data: { password: "newpassword456" },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.wifi_data.ssid).toBe("MyNetwork"); // preserved
    expect(body.wifi_data.password).toBe("newpassword456"); // updated
  });

  it("should return WiFi info JSON on GET /r/:shortId for WiFi type", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${wifiShortId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.type).toBe("wifi");
    expect(body.ssid).toBe("MyNetwork");
    expect(body.hint).toBeTruthy();
  });
});

// ─── QR Type Edge Cases ─────────────────────────────────

describe("QR Type Edge Cases", () => {
  it("should default to type=url when no type specified", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: { target_url: "https://backward-compat.example.com" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.type).toBe("url");
    expect(body.target_url).toBe("https://backward-compat.example.com");
  });

  it("should reject url type without target_url", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: { type: "url", label: "no-url" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("MISSING_REQUIRED_FIELD");
  });

  it("should delete vCard/WiFi QR codes normally", async () => {
    // Create a vCard QR to delete
    const createRes = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "vcard",
        vcard_data: { first_name: "Delete", last_name: "Me" },
      },
    });
    const { short_id } = createRes.json();

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/qr/${short_id}`,
      headers: { "x-api-key": apiKey },
    });
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json().deleted).toBe(true);
  });

  it("should handle WiFi with special characters in SSID", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "wifi",
        wifi_data: { ssid: 'Café "Le Bon";Wifi', password: "pass;word", encryption: "WPA" },
      },
    });
    expect(res.statusCode).toBe(201);
    // The SVG should contain the escaped WiFi string
    expect(res.json().image_data).toBeTruthy();
  });
});

// ─── Email QR Codes ─────────────────────────────────────

describe("Email QR Codes", () => {
  let emailShortId: string;

  it("should create an email QR code with to only", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "email",
        email_data: { to: "hello@example.com" },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    emailShortId = body.short_id;
    expect(body.type).toBe("email");
    expect(body.email_data.to).toBe("hello@example.com");
    expect(body.target_url).toBeNull();
  });

  it("should create an email QR with all fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "email",
        email_data: { to: "sales@acme.com", subject: "Quote", body: "Please send quote", cc: "boss@acme.com", bcc: "archive@acme.com" },
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().email_data.subject).toBe("Quote");
  });

  it("should reject email without to", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: { type: "email", email_data: { subject: "No recipient" } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("MISSING_REQUIRED_FIELD");
  });

  it("should redirect to mailto: on GET /r/:shortId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${emailShortId}`,
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("mailto:hello@example.com");
  });
});

// ─── SMS QR Codes ───────────────────────────────────────

describe("SMS QR Codes", () => {
  let smsShortId: string;

  it("should create an SMS QR code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "sms",
        sms_data: { phone_number: "+33612345678", message: "Hello!" },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    smsShortId = body.short_id;
    expect(body.type).toBe("sms");
    expect(body.sms_data.phone_number).toBe("+33612345678");
  });

  it("should reject SMS without phone_number", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: { type: "sms", sms_data: { message: "No phone" } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("MISSING_REQUIRED_FIELD");
  });

  it("should redirect to sms: on GET /r/:shortId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${smsShortId}`,
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("sms:+33612345678");
  });
});

// ─── Phone QR Codes ─────────────────────────────────────

describe("Phone QR Codes", () => {
  let phoneShortId: string;

  it("should create a phone QR code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "phone",
        phone_data: { phone_number: "+33145678900" },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    phoneShortId = body.short_id;
    expect(body.type).toBe("phone");
    expect(body.phone_data.phone_number).toBe("+33145678900");
  });

  it("should reject phone without phone_number", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: { type: "phone", phone_data: {} },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("MISSING_REQUIRED_FIELD");
  });

  it("should redirect to tel: on GET /r/:shortId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${phoneShortId}`,
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("tel:+33145678900");
  });
});

// ─── Event QR Codes ─────────────────────────────────────

describe("Event QR Codes", () => {
  let eventShortId: string;

  it("should create an event QR code with required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "event",
        event_data: {
          summary: "Team Meeting",
          start: "2026-03-15T09:00:00Z",
          end: "2026-03-15T10:00:00Z",
        },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    eventShortId = body.short_id;
    expect(body.type).toBe("event");
    expect(body.event_data.summary).toBe("Team Meeting");
  });

  it("should create event QR with all fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "event",
        event_data: {
          summary: "Conference",
          start: "2026-06-01T09:00:00Z",
          end: "2026-06-01T17:00:00Z",
          location: "Paris Expo",
          description: "Annual conference",
        },
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().event_data.location).toBe("Paris Expo");
  });

  it("should reject event without summary/start/end", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: { type: "event", event_data: { summary: "Incomplete" } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("MISSING_REQUIRED_FIELD");
  });

  it("should serve .ics file on GET /r/:shortId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${eventShortId}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/calendar");
    expect(res.headers["content-disposition"]).toContain("event.ics");
    expect(res.body).toContain("BEGIN:VCALENDAR");
    expect(res.body).toContain("BEGIN:VEVENT");
    expect(res.body).toContain("Team Meeting");
  });
});

// ─── Text QR Codes ──────────────────────────────────────

describe("Text QR Codes", () => {
  let textShortId: string;

  it("should create a text QR code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "text",
        text_data: { content: "Hello World! This is a QR message." },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    textShortId = body.short_id;
    expect(body.type).toBe("text");
    expect(body.text_data.content).toBe("Hello World! This is a QR message.");
  });

  it("should reject text without content", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: { type: "text", text_data: {} },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("MISSING_REQUIRED_FIELD");
  });

  it("should return JSON with content on GET /r/:shortId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${textShortId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.type).toBe("text");
    expect(body.content).toBe("Hello World! This is a QR message.");
  });
});

// ─── Location QR Codes ──────────────────────────────────

describe("Location QR Codes", () => {
  let locationShortId: string;

  it("should create a location QR code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "location",
        location_data: { latitude: 48.8566, longitude: 2.3522, label: "Paris" },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    locationShortId = body.short_id;
    expect(body.type).toBe("location");
    expect(body.location_data.latitude).toBe(48.8566);
    expect(body.location_data.longitude).toBe(2.3522);
  });

  it("should reject location without coordinates", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: { type: "location", location_data: { label: "Nowhere" } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("MISSING_REQUIRED_FIELD");
  });

  it("should redirect to Google Maps on GET /r/:shortId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${locationShortId}`,
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("google.com/maps");
    expect(res.headers.location).toContain("48.8566");
  });
});

// ─── Social QR Codes ────────────────────────────────────

describe("Social QR Codes", () => {
  let socialShortId: string;

  it("should create a social QR code with multiple platforms", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "social",
        social_data: {
          twitter: "https://twitter.com/testuser",
          linkedin: "https://linkedin.com/in/testuser",
          github: "https://github.com/testuser",
        },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    socialShortId = body.short_id;
    expect(body.type).toBe("social");
    expect(body.social_data.twitter).toBe("https://twitter.com/testuser");
  });

  it("should reject social without any platform link", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: { type: "social", social_data: {} },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("MISSING_REQUIRED_FIELD");
  });

  it("should return JSON with platforms on GET /r/:shortId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${socialShortId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.type).toBe("social");
    expect(body.platforms.twitter).toBe("https://twitter.com/testuser");
    expect(body.platforms.github).toBe("https://github.com/testuser");
  });
});

// ─── App Store QR Codes ─────────────────────────────────

describe("App Store QR Codes", () => {
  let appStoreShortId: string;

  it("should create an app store QR code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        type: "app_store",
        app_store_data: {
          ios_url: "https://apps.apple.com/app/id123",
          android_url: "https://play.google.com/store/apps/details?id=com.example",
          fallback_url: "https://example.com/app",
        },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    appStoreShortId = body.short_id;
    expect(body.type).toBe("app_store");
    expect(body.app_store_data.ios_url).toBe("https://apps.apple.com/app/id123");
  });

  it("should reject app_store without any store URL", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: { type: "app_store", app_store_data: { fallback_url: "https://example.com" } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("MISSING_REQUIRED_FIELD");
  });

  it("should redirect to iOS App Store for iPhone user-agent", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${appStoreShortId}`,
      headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://apps.apple.com/app/id123");
  });

  it("should redirect to Play Store for Android user-agent", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${appStoreShortId}`,
      headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8)" },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://play.google.com/store/apps/details?id=com.example");
  });
});

// ─── UTM Parameters ──────────────────────────────────────

describe("UTM Parameters", () => {
  let utmShortId: string;

  it("should create a URL QR code with utm_params", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        target_url: "https://example.com/landing",
        label: "utm-test",
        utm_params: { source: "flyer", medium: "print", campaign: "summer_2026" },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    utmShortId = body.short_id;
    expect(body.utm_params).toEqual({ source: "flyer", medium: "print", campaign: "summer_2026" });
  });

  it("should append UTM params to redirect URL", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${utmShortId}`,
    });
    expect(res.statusCode).toBe(302);
    const location = res.headers.location as string;
    expect(location).toContain("utm_source=flyer");
    expect(location).toContain("utm_medium=print");
    expect(location).toContain("utm_campaign=summer_2026");
  });

  it("should update utm_params", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/qr/${utmShortId}`,
      headers: { "x-api-key": apiKey },
      payload: { utm_params: { source: "email", medium: "newsletter" } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().utm_params).toEqual({ source: "email", medium: "newsletter" });
  });

  it("should clear utm_params when set to null", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/qr/${utmShortId}`,
      headers: { "x-api-key": apiKey },
      payload: { utm_params: null },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().utm_params).toBeNull();

    // Verify redirect no longer has UTM params
    const redirect = await app.inject({ method: "GET", url: `/r/${utmShortId}` });
    expect(redirect.statusCode).toBe(302);
    expect(redirect.headers.location).toBe("https://example.com/landing");
  });
});

// ─── GTM Container ──────────────────────────────────────

describe("GTM Container", () => {
  let gtmShortId: string;

  it("should create a URL QR code with gtm_container_id", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        target_url: "https://example.com/gtm-landing",
        label: "gtm-test",
        gtm_container_id: "GTM-ABC123",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    gtmShortId = body.short_id;
    expect(body.gtm_container_id).toBe("GTM-ABC123");
  });

  it("should serve an HTML page with GTM snippet instead of 302", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${gtmShortId}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    const html = res.body;
    expect(html).toContain("GTM-ABC123");
    expect(html).toContain("googletagmanager.com");
    expect(html).toContain("https://example.com/gtm-landing");
  });

  it("should include GTM head and noscript snippets", async () => {
    const res = await app.inject({ method: "GET", url: `/r/${gtmShortId}` });
    const html = res.body;
    expect(html).toContain("gtm.start");
    expect(html).toContain("<noscript>");
    expect(html).toContain('content="1;url=');
  });

  it("should restore normal 302 redirect after clearing gtm_container_id", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/qr/${gtmShortId}`,
      headers: { "x-api-key": apiKey },
      payload: { gtm_container_id: null },
    });
    const res = await app.inject({ method: "GET", url: `/r/${gtmShortId}` });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://example.com/gtm-landing");
  });
});

// ─── Conditional Redirects ──────────────────────────────

describe("Conditional Redirects", () => {
  let rulesShortId: string;

  it("should create a URL QR code with redirect_rules", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        target_url: "https://example.com/default",
        label: "rules-test",
        redirect_rules: [
          { condition: { type: "device", value: "mobile" }, target_url: "https://m.example.com" },
          { condition: { type: "os", value: "iOS" }, target_url: "https://ios.example.com" },
          { condition: { type: "language", value: "fr" }, target_url: "https://fr.example.com" },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    rulesShortId = body.short_id;
    expect(body.redirect_rules).toHaveLength(3);
  });

  it("should redirect mobile UA to mobile URL (device rule)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/r/${rulesShortId}`,
      headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://m.example.com");
  });

  it("should redirect French Accept-Language to FR URL (language rule)", async () => {
    // Desktop + French language → device rule won't match, OS rule won't match, language rule matches
    const res = await app.inject({
      method: "GET",
      url: `/r/${rulesShortId}`,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://fr.example.com");
  });

  it("should fall back to default URL when no rule matches", async () => {
    // Desktop + English → no rule matches
    const res = await app.inject({
      method: "GET",
      url: `/r/${rulesShortId}`,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://example.com/default");
  });

  it("should validate redirect_rules target URLs", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        target_url: "https://example.com",
        redirect_rules: [
          { condition: { type: "device", value: "mobile" }, target_url: "not-a-url" },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INVALID_URL");
  });

  it("should validate redirect_rules condition types", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        target_url: "https://example.com",
        redirect_rules: [
          { condition: { type: "invalid_type", value: "test" }, target_url: "https://example.com/mobile" },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("should update redirect_rules", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/qr/${rulesShortId}`,
      headers: { "x-api-key": apiKey },
      payload: {
        redirect_rules: [
          { condition: { type: "device", value: "tablet" }, target_url: "https://tablet.example.com" },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().redirect_rules).toHaveLength(1);
    expect(res.json().redirect_rules[0].condition.value).toBe("tablet");
  });

  it("should clear redirect_rules when set to null", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/qr/${rulesShortId}`,
      headers: { "x-api-key": apiKey },
      payload: { redirect_rules: null },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().redirect_rules).toBeNull();
  });
});

// ─── UTM + GTM + Rules combined ──────────────────────────

describe("UTM + GTM Combined", () => {
  it("should apply UTM params inside GTM page URL", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/qr",
      headers: { "x-api-key": apiKey },
      payload: {
        target_url: "https://example.com/combo",
        utm_params: { source: "qr", medium: "print" },
        gtm_container_id: "GTM-COMBO1",
      },
    });
    expect(res.statusCode).toBe(201);
    const shortId = res.json().short_id;

    const redirect = await app.inject({ method: "GET", url: `/r/${shortId}` });
    expect(redirect.statusCode).toBe(200);
    expect(redirect.headers["content-type"]).toContain("text/html");
    const html = redirect.body;
    expect(html).toContain("GTM-COMBO1");
    expect(html).toContain("utm_source=qr");
    expect(html).toContain("utm_medium=print");
  });
});
