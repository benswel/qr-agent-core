import { eq, and, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import crypto from "node:crypto";
import { db, schema } from "../../db/index.js";
import type { Plan } from "../../shared/types.js";
import { PLAN_LIMITS } from "../../shared/types.js";

const { webhooks, webhookDeliveries, qrCodes } = schema;

export function createWebhook(
  url: string,
  events: string[],
  apiKeyId: number,
  plan: Plan = "free"
) {
  // Check plan quota
  const limits = PLAN_LIMITS[plan];
  if (limits.maxWebhooks !== Infinity) {
    const [{ total }] = db
      .select({ total: count() })
      .from(webhooks)
      .where(eq(webhooks.apiKeyId, apiKeyId))
      .all();

    if (total >= limits.maxWebhooks) {
      return { error: "WEBHOOK_LIMIT_REACHED" as const, limit: limits.maxWebhooks };
    }
  }

  const secret = nanoid(32);

  const inserted = db
    .insert(webhooks)
    .values({
      apiKeyId,
      url,
      secret,
      events: JSON.stringify(events),
      isActive: true,
    })
    .returning()
    .get();

  return {
    id: inserted.id,
    url: inserted.url,
    secret: inserted.secret,
    events: JSON.parse(inserted.events) as string[],
    is_active: inserted.isActive,
    created_at: inserted.createdAt,
  };
}

export function listWebhooks(apiKeyId: number) {
  const rows = db
    .select()
    .from(webhooks)
    .where(eq(webhooks.apiKeyId, apiKeyId))
    .all();

  const [{ total }] = db
    .select({ total: count() })
    .from(webhooks)
    .where(eq(webhooks.apiKeyId, apiKeyId))
    .all();

  return {
    data: rows.map((row) => ({
      id: row.id,
      url: row.url,
      events: JSON.parse(row.events) as string[],
      is_active: row.isActive,
      created_at: row.createdAt,
    })),
    total,
  };
}

export function deleteWebhook(webhookId: number, apiKeyId: number): boolean {
  const existing = db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.apiKeyId, apiKeyId)))
    .get();

  if (!existing) return false;

  db.delete(webhooks).where(eq(webhooks.id, webhookId)).run();
  return true;
}

/**
 * Compute HMAC-SHA256 signature for a webhook payload.
 */
function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/**
 * Deliver a single webhook event. Logs the delivery attempt.
 */
async function deliverWebhook(
  webhook: { id: number; url: string; secret: string },
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const payload = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data,
  });

  const signature = signPayload(payload, webhook.secret);

  let status = "success";
  let responseCode: number | null = null;
  let errorMessage: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": event,
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseCode = res.status;

    if (!res.ok) {
      status = "failed";
      errorMessage = `HTTP ${res.status}`;
    }
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : "Unknown error";
  }

  // Log delivery attempt
  db.insert(webhookDeliveries)
    .values({
      webhookId: webhook.id,
      event,
      payload,
      status,
      responseCode,
      errorMessage,
    })
    .run();
}

/**
 * Dispatch qr.conversion event to all active webhooks for the given API key.
 * Fire-and-forget: errors are logged but don't propagate.
 */
export async function dispatchConversionEvent(
  shortId: string,
  eventName: string,
  value: number | null,
  metadata: Record<string, unknown> | null,
  apiKeyId: number
): Promise<void> {
  const activeWebhooks = db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.apiKeyId, apiKeyId), eq(webhooks.isActive, true)))
    .all();

  if (activeWebhooks.length === 0) return;

  const relevantWebhooks = activeWebhooks.filter((wh) => {
    const events = JSON.parse(wh.events) as string[];
    return events.includes("qr.conversion");
  });

  if (relevantWebhooks.length === 0) return;

  const data = {
    short_id: shortId,
    event_name: eventName,
    value,
    metadata,
  };

  await Promise.allSettled(
    relevantWebhooks.map((wh) =>
      deliverWebhook(
        { id: wh.id, url: wh.url, secret: wh.secret },
        "qr.conversion",
        data
      )
    )
  );
}

/**
 * Dispatch qr.scanned event to all active webhooks for the given API key.
 * Fire-and-forget: errors are logged but don't propagate.
 */
export async function dispatchScannedEvent(
  shortId: string,
  targetUrl: string,
  label: string | null,
  scanData: {
    user_agent?: string;
    referer?: string;
    ip?: string;
    scanned_at: string;
  },
  apiKeyId: number
): Promise<void> {
  const activeWebhooks = db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.apiKeyId, apiKeyId), eq(webhooks.isActive, true)))
    .all();

  if (activeWebhooks.length === 0) return;

  // Filter to webhooks subscribed to qr.scanned
  const relevantWebhooks = activeWebhooks.filter((wh) => {
    const events = JSON.parse(wh.events) as string[];
    return events.includes("qr.scanned");
  });

  if (relevantWebhooks.length === 0) return;

  const data = {
    short_id: shortId,
    target_url: targetUrl,
    label,
    scan: scanData,
  };

  // Fire all deliveries in parallel, catch individual errors
  await Promise.allSettled(
    relevantWebhooks.map((wh) =>
      deliverWebhook(
        { id: wh.id, url: wh.url, secret: wh.secret },
        "qr.scanned",
        data
      )
    )
  );
}
