import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "../../db/index.js";

const { apiKeys } = schema;

const KEY_PREFIX = "qr_";
const KEY_LENGTH = 32;

export function generateApiKey(label: string): { key: string; id: number; label: string } {
  const key = `${KEY_PREFIX}${nanoid(KEY_LENGTH)}`;

  const inserted = db
    .insert(apiKeys)
    .values({ key, label })
    .returning()
    .get();

  return { key: inserted.key, id: inserted.id, label: inserted.label };
}

export function validateApiKey(key: string): boolean {
  const row = db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.key, key))
    .get();

  if (!row) return false;

  // Check expiration
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
    return false;
  }

  // Update last_used_at (fire-and-forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(apiKeys.key, key))
    .run();

  return true;
}

export function listApiKeys() {
  return db
    .select({
      id: apiKeys.id,
      label: apiKeys.label,
      keyPreview: apiKeys.key,
      createdAt: apiKeys.createdAt,
      expiresAt: apiKeys.expiresAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .all()
    .map((row) => ({
      ...row,
      // Only show first 10 chars of the key for security
      keyPreview: row.keyPreview.substring(0, 10) + "...",
    }));
}

export function revokeApiKey(id: number): boolean {
  const existing = db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, id))
    .get();

  if (!existing) return false;

  db.delete(apiKeys).where(eq(apiKeys.id, id)).run();
  return true;
}
