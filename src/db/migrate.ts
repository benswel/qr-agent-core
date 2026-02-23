import { db } from "./index.js";
import { qrCodes, scanEvents } from "./schema.js";
import { sql } from "drizzle-orm";

/**
 * Push schema to SQLite — creates tables if they don't exist.
 * For a simple SQLite setup, we use direct CREATE IF NOT EXISTS
 * rather than full migration files during early development.
 */
export function runMigrations() {
  db.run(sql`
    CREATE TABLE IF NOT EXISTS qr_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_id TEXT NOT NULL UNIQUE,
      target_url TEXT NOT NULL,
      label TEXT,
      format TEXT NOT NULL DEFAULT 'svg',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS scan_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      qr_code_id INTEGER NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
      scanned_at TEXT NOT NULL,
      user_agent TEXT,
      referer TEXT,
      ip TEXT
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      last_used_at TEXT
    )
  `);

  db.run(sql`CREATE INDEX IF NOT EXISTS idx_qr_codes_short_id ON qr_codes(short_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_scan_events_qr_code_id ON scan_events(qr_code_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key)`);
}
