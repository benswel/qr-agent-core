import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * API keys for agent authentication.
 * Each key has a label (for the human who created it)
 * and an optional expiration date.
 */
export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  email: text("email"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at"),
  lastUsedAt: text("last_used_at"),
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
});

/**
 * Core table: each row is a "managed QR code".
 * The short_id is the public-facing identifier used in short URLs.
 * target_url can be updated at any time — the QR image stays the same.
 * apiKeyId tracks which API key owns this QR code (multi-tenant isolation).
 * styleOptions stores JSON-serialized QrStyleOptions for image regeneration.
 */
export const qrCodes = sqliteTable("qr_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shortId: text("short_id").notNull().unique(),
  targetUrl: text("target_url").notNull(),
  label: text("label"),
  format: text("format", { enum: ["svg", "png"] }).notNull().default("svg"),
  styleOptions: text("style_options"),
  apiKeyId: integer("api_key_id").references(() => apiKeys.id),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at"),
  scheduledUrl: text("scheduled_url"),
  scheduledAt: text("scheduled_at"),
  type: text("type").notNull().default("url"),
  typeData: text("type_data"),
});

/**
 * Analytics: one row per scan/redirect event.
 * Intentionally minimal — we store what's useful for agents,
 * not full browser fingerprints.
 */
export const scanEvents = sqliteTable("scan_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  qrCodeId: integer("qr_code_id")
    .notNull()
    .references(() => qrCodes.id, { onDelete: "cascade" }),
  scannedAt: text("scanned_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  userAgent: text("user_agent"),
  referer: text("referer"),
  ip: text("ip"),
  deviceType: text("device_type"),
  browser: text("browser"),
  os: text("os"),
  country: text("country"),
  city: text("city"),
});

/**
 * Webhook endpoints registered by API keys.
 * Each webhook receives POST requests when subscribed events occur.
 * The secret is used for HMAC-SHA256 signature verification.
 */
export const webhooks = sqliteTable("webhooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  apiKeyId: integer("api_key_id")
    .notNull()
    .references(() => apiKeys.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").notNull(), // JSON array: ["qr.scanned"]
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Webhook delivery log: tracks each delivery attempt.
 */
export const webhookDeliveries = sqliteTable("webhook_deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  webhookId: integer("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: text("payload").notNull(), // JSON string
  status: text("status").notNull(), // "success" | "failed"
  responseCode: integer("response_code"),
  errorMessage: text("error_message"),
  deliveredAt: text("delivered_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type QrCode = typeof qrCodes.$inferSelect;
export type NewQrCode = typeof qrCodes.$inferInsert;
export type ScanEvent = typeof scanEvents.$inferSelect;
export type NewScanEvent = typeof scanEvents.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
