import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Core table: each row is a "managed QR code".
 * The short_id is the public-facing identifier used in short URLs.
 * target_url can be updated at any time — the QR image stays the same.
 */
export const qrCodes = sqliteTable("qr_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shortId: text("short_id").notNull().unique(),
  targetUrl: text("target_url").notNull(),
  label: text("label"),
  format: text("format", { enum: ["svg", "png"] }).notNull().default("svg"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
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
});

/**
 * API keys for agent authentication.
 * Each key has a label (for the human who created it)
 * and an optional expiration date.
 */
export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at"),
  lastUsedAt: text("last_used_at"),
});

export type QrCode = typeof qrCodes.$inferSelect;
export type NewQrCode = typeof qrCodes.$inferInsert;
export type ScanEvent = typeof scanEvents.$inferSelect;
export type NewScanEvent = typeof scanEvents.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
