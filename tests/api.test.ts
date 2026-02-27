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
// Pro Waitlist
// ============================================================

describe("Pro Waitlist", () => {
  it("should accept a valid email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/waitlist",
      payload: { email: "waitlist@example.com" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().message).toContain("on the list");
  });

  it("should return 200 for duplicate email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/waitlist",
      payload: { email: "waitlist@example.com" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toContain("already on the list");
  });

  it("should reject invalid email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/waitlist",
      payload: { email: "not-an-email" },
    });

    expect(res.statusCode).toBe(400);
  });
});
