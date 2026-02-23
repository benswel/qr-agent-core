import { eq, and, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "../../db/index.js";
import { config } from "../../config/index.js";
import { renderQrCode } from "./qr.renderer.js";
import type { QrFormat } from "../../shared/types.js";

const { qrCodes } = schema;

export interface CreateQrInput {
  target_url: string;
  label?: string;
  format?: QrFormat;
}

export interface UpdateQrInput {
  target_url?: string;
  label?: string;
}

export async function createQrCode(input: CreateQrInput, apiKeyId: number) {
  const shortId = nanoid(config.shortId.length);
  const format = input.format || "svg";
  const shortUrl = `${config.baseUrl}/r/${shortId}`;

  const imageData = await renderQrCode(shortUrl, format);

  const inserted = db
    .insert(qrCodes)
    .values({
      shortId,
      targetUrl: input.target_url,
      label: input.label || null,
      format,
      apiKeyId,
    })
    .returning()
    .get();

  return {
    id: inserted.id,
    short_id: inserted.shortId,
    short_url: shortUrl,
    target_url: inserted.targetUrl,
    label: inserted.label,
    format: inserted.format,
    image_data: imageData,
    created_at: inserted.createdAt,
  };
}

export function getQrCode(shortId: string, apiKeyId: number) {
  const row = db
    .select()
    .from(qrCodes)
    .where(and(eq(qrCodes.shortId, shortId), eq(qrCodes.apiKeyId, apiKeyId)))
    .get();

  if (!row) return null;

  return {
    id: row.id,
    short_id: row.shortId,
    short_url: `${config.baseUrl}/r/${row.shortId}`,
    target_url: row.targetUrl,
    label: row.label,
    format: row.format,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function listQrCodes(limit: number = 20, offset: number = 0, apiKeyId: number) {
  const rows = db
    .select()
    .from(qrCodes)
    .where(eq(qrCodes.apiKeyId, apiKeyId))
    .limit(limit)
    .offset(offset)
    .all();

  const [{ total }] = db
    .select({ total: count() })
    .from(qrCodes)
    .where(eq(qrCodes.apiKeyId, apiKeyId))
    .all();

  return {
    data: rows.map((row) => ({
      id: row.id,
      short_id: row.shortId,
      short_url: `${config.baseUrl}/r/${row.shortId}`,
      target_url: row.targetUrl,
      label: row.label,
      format: row.format,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    })),
    total,
    offset,
    limit,
  };
}

export function updateQrCode(shortId: string, input: UpdateQrInput, apiKeyId: number) {
  const existing = db
    .select()
    .from(qrCodes)
    .where(and(eq(qrCodes.shortId, shortId), eq(qrCodes.apiKeyId, apiKeyId)))
    .get();

  if (!existing) return null;

  const updated = db
    .update(qrCodes)
    .set({
      ...(input.target_url !== undefined && { targetUrl: input.target_url }),
      ...(input.label !== undefined && { label: input.label }),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(qrCodes.shortId, shortId))
    .returning()
    .get();

  return {
    id: updated.id,
    short_id: updated.shortId,
    short_url: `${config.baseUrl}/r/${updated.shortId}`,
    target_url: updated.targetUrl,
    label: updated.label,
    format: updated.format,
    created_at: updated.createdAt,
    updated_at: updated.updatedAt,
  };
}

export function deleteQrCode(shortId: string, apiKeyId: number): boolean {
  const existing = db
    .select()
    .from(qrCodes)
    .where(and(eq(qrCodes.shortId, shortId), eq(qrCodes.apiKeyId, apiKeyId)))
    .get();

  if (!existing) return false;

  db.delete(qrCodes).where(eq(qrCodes.shortId, shortId)).run();
  return true;
}

export async function getQrImage(shortId: string, formatOverride?: QrFormat, apiKeyId?: number) {
  // If apiKeyId is provided, scope by owner (authenticated /api/ route)
  // If not provided, allow access (public /i/ route)
  const conditions = apiKeyId !== undefined
    ? and(eq(qrCodes.shortId, shortId), eq(qrCodes.apiKeyId, apiKeyId))
    : eq(qrCodes.shortId, shortId);

  const row = db
    .select()
    .from(qrCodes)
    .where(conditions)
    .get();

  if (!row) return null;

  const format = formatOverride || (row.format as QrFormat);
  const shortUrl = `${config.baseUrl}/r/${row.shortId}`;
  const imageData = await renderQrCode(shortUrl, format);

  return { imageData, format };
}

export function getTargetUrl(shortId: string): string | null {
  const row = db
    .select({ targetUrl: qrCodes.targetUrl })
    .from(qrCodes)
    .where(eq(qrCodes.shortId, shortId))
    .get();

  return row?.targetUrl || null;
}
