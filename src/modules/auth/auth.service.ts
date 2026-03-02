import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "../../db/index.js";
import type { ApiKey } from "../../db/schema.js";
import type { Plan } from "../../shared/types.js";

const { apiKeys } = schema;

const KEY_PREFIX = "qr_";
const KEY_LENGTH = 32;

export function generateApiKey(label: string, email?: string): { key: string; id: number; label: string } {
  const key = `${KEY_PREFIX}${nanoid(KEY_LENGTH)}`;

  const inserted = db
    .insert(apiKeys)
    .values({ key, label, ...(email ? { email } : {}) })
    .returning()
    .get();

  return { key: inserted.key, id: inserted.id, label: inserted.label };
}

/**
 * Validates an API key and returns its ID if valid, null otherwise.
 */
export function validateApiKey(key: string): number | null {
  const row = db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.key, key))
    .get();

  if (!row) return null;

  // Check expiration
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
    return null;
  }

  // Update last_used_at (fire-and-forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(apiKeys.key, key))
    .run();

  return row.id;
}

/**
 * Ensures the env API_KEY exists in the database and returns its ID.
 * Inserts it with label "env-api-key" if not present.
 */
export function ensureEnvKeyInDb(envKey: string): number {
  const existing = db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.key, envKey))
    .get();

  if (existing) return existing.id;

  const inserted = db
    .insert(apiKeys)
    .values({ key: envKey, label: "env-api-key" })
    .returning()
    .get();

  return inserted.id;
}

export function setApiKeyPlan(keyId: number, plan: Plan): void {
  db.update(apiKeys)
    .set({ plan })
    .where(eq(apiKeys.id, keyId))
    .run();
}

export function getApiKeyPlan(keyId: number): Plan {
  const row = db
    .select({ plan: apiKeys.plan })
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .get();

  return (row?.plan as Plan) || "free";
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

export function getApiKeyById(id: number): ApiKey | undefined {
  return db.select().from(apiKeys).where(eq(apiKeys.id, id)).get();
}

export function setStripeCustomerId(keyId: number, stripeCustomerId: string): void {
  db.update(apiKeys)
    .set({ stripeCustomerId })
    .where(eq(apiKeys.id, keyId))
    .run();
}

export function setStripeSubscriptionId(keyId: number, stripeSubscriptionId: string | null): void {
  db.update(apiKeys)
    .set({ stripeSubscriptionId })
    .where(eq(apiKeys.id, keyId))
    .run();
}

export function getApiKeyByStripeCustomerId(stripeCustomerId: string): ApiKey | undefined {
  return db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.stripeCustomerId, stripeCustomerId))
    .get();
}

export function getCustomDomain(keyId: number): string | null {
  const row = db
    .select({ customDomain: apiKeys.customDomain })
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .get();
  return row?.customDomain || null;
}

export function setCustomDomain(keyId: number, domain: string | null): void {
  db.update(apiKeys)
    .set({ customDomain: domain })
    .where(eq(apiKeys.id, keyId))
    .run();
}

export function isCustomDomainTaken(domain: string, excludeKeyId: number): boolean {
  const row = db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.customDomain, domain))
    .get();
  return !!row && row.id !== excludeKeyId;
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
