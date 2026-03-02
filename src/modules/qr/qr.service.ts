import { eq, and, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "../../db/index.js";
import { config } from "../../config/index.js";
import { renderQrCode } from "./qr.renderer.js";
import type { QrFormat, QrStyleOptions, Plan } from "../../shared/types.js";
import { PLAN_LIMITS } from "../../shared/types.js";

const { qrCodes } = schema;

export interface CreateQrInput {
  target_url: string;
  label?: string;
  format?: QrFormat;
  foreground_color?: string;
  background_color?: string;
  width?: number;
  margin?: number;
  error_correction?: "L" | "M" | "Q" | "H";
  dot_style?: string;
  corner_style?: string;
  logo_url?: string;
  logo_size?: number;
}

export interface UpdateQrInput {
  target_url?: string;
  label?: string;
}

function buildStyleOptions(input: CreateQrInput): QrStyleOptions | undefined {
  const style: QrStyleOptions = {};
  let hasStyle = false;

  if (input.foreground_color) { style.foreground_color = input.foreground_color; hasStyle = true; }
  if (input.background_color) { style.background_color = input.background_color; hasStyle = true; }
  if (input.width) { style.width = input.width; hasStyle = true; }
  if (input.margin !== undefined) { style.margin = input.margin; hasStyle = true; }
  if (input.error_correction) { style.error_correction = input.error_correction; hasStyle = true; }
  if (input.dot_style) { style.dot_style = input.dot_style as QrStyleOptions["dot_style"]; hasStyle = true; }
  if (input.corner_style) { style.corner_style = input.corner_style as QrStyleOptions["corner_style"]; hasStyle = true; }
  if (input.logo_url) { style.logo_url = input.logo_url; hasStyle = true; }
  if (input.logo_size) { style.logo_size = input.logo_size; hasStyle = true; }

  return hasStyle ? style : undefined;
}

export async function createQrCode(input: CreateQrInput, apiKeyId: number, plan: Plan = "free") {
  // Check plan quota
  const limits = PLAN_LIMITS[plan];
  if (limits.maxQrCodes !== Infinity) {
    const [{ total }] = db
      .select({ total: count() })
      .from(qrCodes)
      .where(eq(qrCodes.apiKeyId, apiKeyId))
      .all();

    if (total >= limits.maxQrCodes) {
      return { error: "QR_CODE_LIMIT_REACHED", limit: limits.maxQrCodes };
    }
  }

  const shortId = nanoid(config.shortId.length);
  const format = input.format || "svg";
  const shortUrl = `${config.baseUrl}/r/${shortId}`;

  const styleOptions = buildStyleOptions(input);
  const imageData = await renderQrCode(shortUrl, format, styleOptions);

  const inserted = db
    .insert(qrCodes)
    .values({
      shortId,
      targetUrl: input.target_url,
      label: input.label || null,
      format,
      styleOptions: styleOptions ? JSON.stringify(styleOptions) : null,
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
  const styleOptions: QrStyleOptions | undefined = row.styleOptions
    ? JSON.parse(row.styleOptions)
    : undefined;

  const imageData = await renderQrCode(shortUrl, format, styleOptions);

  return { imageData, format };
}

// ---- Bulk operations ----

export async function bulkCreateQrCodes(
  items: CreateQrInput[],
  apiKeyId: number,
  plan: Plan = "free"
) {
  // Check plan quota upfront (all-or-nothing)
  const limits = PLAN_LIMITS[plan];
  if (limits.maxQrCodes !== Infinity) {
    const [{ total }] = db
      .select({ total: count() })
      .from(qrCodes)
      .where(eq(qrCodes.apiKeyId, apiKeyId))
      .all();

    const remaining = limits.maxQrCodes - total;
    if (items.length > remaining) {
      return {
        error: "QR_CODE_LIMIT_REACHED" as const,
        limit: limits.maxQrCodes,
        existing: total,
        requested: items.length,
        remaining,
      };
    }
  }

  const results = [];
  for (const input of items) {
    const shortId = nanoid(config.shortId.length);
    const format = input.format || "svg";
    const shortUrl = `${config.baseUrl}/r/${shortId}`;
    const styleOptions = buildStyleOptions(input);
    const imageData = await renderQrCode(shortUrl, format, styleOptions);

    const inserted = db
      .insert(qrCodes)
      .values({
        shortId,
        targetUrl: input.target_url,
        label: input.label || null,
        format,
        styleOptions: styleOptions ? JSON.stringify(styleOptions) : null,
        apiKeyId,
      })
      .returning()
      .get();

    results.push({
      id: inserted.id,
      short_id: inserted.shortId,
      short_url: shortUrl,
      target_url: inserted.targetUrl,
      label: inserted.label,
      format: inserted.format,
      image_data: imageData,
      created_at: inserted.createdAt,
    });
  }

  return { created: results.length, items: results };
}

export function bulkUpdateQrCodes(
  items: Array<{ short_id: string; target_url?: string; label?: string }>,
  apiKeyId: number
) {
  let updated = 0;
  let notFound = 0;
  const results: Array<{ short_id: string; status: "updated" | "not_found"; target_url?: string; label?: string }> = [];

  for (const item of items) {
    const existing = db
      .select()
      .from(qrCodes)
      .where(and(eq(qrCodes.shortId, item.short_id), eq(qrCodes.apiKeyId, apiKeyId)))
      .get();

    if (!existing) {
      notFound++;
      results.push({ short_id: item.short_id, status: "not_found" });
      continue;
    }

    db.update(qrCodes)
      .set({
        ...(item.target_url !== undefined && { targetUrl: item.target_url }),
        ...(item.label !== undefined && { label: item.label }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(qrCodes.shortId, item.short_id))
      .run();

    updated++;
    results.push({
      short_id: item.short_id,
      status: "updated",
      ...(item.target_url !== undefined && { target_url: item.target_url }),
      ...(item.label !== undefined && { label: item.label }),
    });
  }

  return { updated, not_found: notFound, items: results };
}

export function bulkDeleteQrCodes(shortIds: string[], apiKeyId: number) {
  let deleted = 0;
  let notFound = 0;
  const results: Array<{ short_id: string; status: "deleted" | "not_found" }> = [];

  for (const shortId of shortIds) {
    const existing = db
      .select()
      .from(qrCodes)
      .where(and(eq(qrCodes.shortId, shortId), eq(qrCodes.apiKeyId, apiKeyId)))
      .get();

    if (!existing) {
      notFound++;
      results.push({ short_id: shortId, status: "not_found" });
      continue;
    }

    db.delete(qrCodes).where(eq(qrCodes.shortId, shortId)).run();
    deleted++;
    results.push({ short_id: shortId, status: "deleted" });
  }

  return { deleted, not_found: notFound, items: results };
}

export function getTargetUrl(shortId: string): string | null {
  const row = db
    .select({ targetUrl: qrCodes.targetUrl })
    .from(qrCodes)
    .where(eq(qrCodes.shortId, shortId))
    .get();

  return row?.targetUrl || null;
}
