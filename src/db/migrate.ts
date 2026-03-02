import { db } from "./index.js";
import { sql } from "drizzle-orm";

/**
 * Push schema to SQLite — creates tables if they don't exist.
 * For a simple SQLite setup, we use direct CREATE IF NOT EXISTS
 * rather than full migration files during early development.
 */
export function runMigrations() {
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

  db.run(sql`
    CREATE TABLE IF NOT EXISTS qr_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_id TEXT NOT NULL UNIQUE,
      target_url TEXT NOT NULL,
      label TEXT,
      format TEXT NOT NULL DEFAULT 'svg',
      api_key_id INTEGER REFERENCES api_keys(id),
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

  db.run(sql`CREATE INDEX IF NOT EXISTS idx_qr_codes_short_id ON qr_codes(short_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_scan_events_qr_code_id ON scan_events(qr_code_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key)`);

  // Migration: add api_key_id column if missing (existing DBs)
  try {
    db.run(sql`ALTER TABLE qr_codes ADD COLUMN api_key_id INTEGER REFERENCES api_keys(id)`);
  } catch {
    // Column already exists — ignore
  }

  // Create index after ensuring the column exists
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_qr_codes_api_key_id ON qr_codes(api_key_id)`);

  // Migration: add email column to api_keys if missing (existing DBs)
  try {
    db.run(sql`ALTER TABLE api_keys ADD COLUMN email TEXT`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: add style_options column to qr_codes if missing
  try {
    db.run(sql`ALTER TABLE qr_codes ADD COLUMN style_options TEXT`);
  } catch {
    // Column already exists — ignore
  }

  // Create webhooks table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(sql`CREATE INDEX IF NOT EXISTS idx_webhooks_api_key_id ON webhooks(api_key_id)`);

  // Create webhook_deliveries table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      response_code INTEGER,
      error_message TEXT,
      delivered_at TEXT NOT NULL
    )
  `);

  db.run(sql`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id)`);

  // Migration: add plan column to api_keys if missing (default: 'free')
  try {
    db.run(sql`ALTER TABLE api_keys ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: add Stripe columns to api_keys
  try {
    db.run(sql`ALTER TABLE api_keys ADD COLUMN stripe_customer_id TEXT`);
  } catch {
    // Column already exists — ignore
  }

  try {
    db.run(sql`ALTER TABLE api_keys ADD COLUMN stripe_subscription_id TEXT`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: add expiration & scheduling columns to qr_codes
  try {
    db.run(sql`ALTER TABLE qr_codes ADD COLUMN expires_at TEXT`);
  } catch {
    // Column already exists — ignore
  }

  try {
    db.run(sql`ALTER TABLE qr_codes ADD COLUMN scheduled_url TEXT`);
  } catch {
    // Column already exists — ignore
  }

  try {
    db.run(sql`ALTER TABLE qr_codes ADD COLUMN scheduled_at TEXT`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: add enriched analytics columns to scan_events
  try {
    db.run(sql`ALTER TABLE scan_events ADD COLUMN device_type TEXT`);
  } catch {
    // Column already exists — ignore
  }

  try {
    db.run(sql`ALTER TABLE scan_events ADD COLUMN browser TEXT`);
  } catch {
    // Column already exists — ignore
  }

  try {
    db.run(sql`ALTER TABLE scan_events ADD COLUMN os TEXT`);
  } catch {
    // Column already exists — ignore
  }

  try {
    db.run(sql`ALTER TABLE scan_events ADD COLUMN country TEXT`);
  } catch {
    // Column already exists — ignore
  }

  try {
    db.run(sql`ALTER TABLE scan_events ADD COLUMN city TEXT`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: add QR type columns to qr_codes
  try {
    db.run(sql`ALTER TABLE qr_codes ADD COLUMN type TEXT NOT NULL DEFAULT 'url'`);
  } catch {
    // Column already exists — ignore
  }

  try {
    db.run(sql`ALTER TABLE qr_codes ADD COLUMN type_data TEXT`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: add UTM, GTM, and conditional redirect columns to qr_codes
  try {
    db.run(sql`ALTER TABLE qr_codes ADD COLUMN utm_params TEXT`);
  } catch {
    // Column already exists — ignore
  }

  try {
    db.run(sql`ALTER TABLE qr_codes ADD COLUMN gtm_container_id TEXT`);
  } catch {
    // Column already exists — ignore
  }

  try {
    db.run(sql`ALTER TABLE qr_codes ADD COLUMN redirect_rules TEXT`);
  } catch {
    // Column already exists — ignore
  }

  // Drop legacy pro_waitlist table (Pro is now live via Stripe)
  db.run(sql`DROP TABLE IF EXISTS pro_waitlist`);
}
