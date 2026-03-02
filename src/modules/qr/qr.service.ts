import { eq, and, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "../../db/index.js";
import { config } from "../../config/index.js";
import { renderQrCode } from "./qr.renderer.js";
import { buildVCardString, buildWiFiString, buildEmailString, buildSMSString, buildPhoneString, buildEventString, buildTextString, buildLocationString } from "./qr.content.js";
import type { QrFormat, QrStyleOptions, GradientOptions, Plan, QrType, VCardData, WiFiData, EmailData, SMSData, PhoneData, EventData, TextData, LocationData, SocialData, AppStoreData, UtmParams, RedirectRule } from "../../shared/types.js";
import { PLAN_LIMITS } from "../../shared/types.js";
import { getCustomDomain } from "../auth/auth.service.js";

const { qrCodes } = schema;

export interface CreateQrInput {
  type?: QrType;
  target_url?: string;
  vcard_data?: VCardData;
  wifi_data?: WiFiData;
  email_data?: EmailData;
  sms_data?: SMSData;
  phone_data?: PhoneData;
  event_data?: EventData;
  text_data?: TextData;
  location_data?: LocationData;
  social_data?: SocialData;
  app_store_data?: AppStoreData;
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
  gradient?: GradientOptions;
  expires_at?: string;
  scheduled_url?: string;
  scheduled_at?: string;
  utm_params?: UtmParams;
  gtm_container_id?: string;
  redirect_rules?: RedirectRule[];
  frame_style?: string;
  frame_text?: string;
  frame_color?: string;
  frame_text_color?: string;
  frame_border_radius?: number;
}

export interface UpdateQrInput {
  target_url?: string;
  label?: string;
  vcard_data?: Partial<VCardData>;
  wifi_data?: Partial<WiFiData>;
  email_data?: Partial<EmailData>;
  sms_data?: Partial<SMSData>;
  phone_data?: Partial<PhoneData>;
  event_data?: Partial<EventData>;
  text_data?: Partial<TextData>;
  location_data?: Partial<LocationData>;
  social_data?: Partial<SocialData>;
  app_store_data?: Partial<AppStoreData>;
  expires_at?: string | null;
  scheduled_url?: string | null;
  scheduled_at?: string | null;
  utm_params?: UtmParams | null;
  gtm_container_id?: string | null;
  redirect_rules?: RedirectRule[] | null;
}

/** Determine the string to encode in the QR matrix based on type */
function getQrContent(type: QrType, shortUrl: string, typeData: string | null): string {
  if (!typeData) return shortUrl;
  const data = JSON.parse(typeData);
  switch (type) {
    case "vcard": return buildVCardString(data as VCardData);
    case "wifi": return buildWiFiString(data as WiFiData);
    case "email": return buildEmailString(data as EmailData);
    case "sms": return buildSMSString(data as SMSData);
    case "phone": return buildPhoneString(data as PhoneData);
    case "event": return buildEventString(data as EventData);
    case "text": return buildTextString(data as TextData);
    case "location": return buildLocationString(data as LocationData);
    case "social": return shortUrl; // redirect-based
    case "app_store": return shortUrl; // redirect-based
    default: return shortUrl;
  }
}

/** Build the short URL, using custom domain if set */
function buildShortUrl(shortId: string, customDomain?: string | null): string {
  if (customDomain) return `https://${customDomain}/r/${shortId}`;
  return `${config.baseUrl}/r/${shortId}`;
}

/** Format a DB row into the API response shape */
function formatQrResponse(row: typeof qrCodes.$inferSelect, customDomain?: string | null) {
  const type = (row.type as QrType) || "url";
  const shortUrl = buildShortUrl(row.shortId, customDomain);
  const typeData = row.typeData ? JSON.parse(row.typeData) : null;

  return {
    id: row.id,
    short_id: row.shortId,
    short_url: shortUrl,
    type,
    target_url: type === "url" ? row.targetUrl : null,
    vcard_data: type === "vcard" ? typeData : null,
    wifi_data: type === "wifi" ? typeData : null,
    email_data: type === "email" ? typeData : null,
    sms_data: type === "sms" ? typeData : null,
    phone_data: type === "phone" ? typeData : null,
    event_data: type === "event" ? typeData : null,
    text_data: type === "text" ? typeData : null,
    location_data: type === "location" ? typeData : null,
    social_data: type === "social" ? typeData : null,
    app_store_data: type === "app_store" ? typeData : null,
    label: row.label,
    format: row.format,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    ...(type === "url" ? {
      expires_at: row.expiresAt,
      scheduled_url: row.scheduledUrl,
      scheduled_at: row.scheduledAt,
      utm_params: row.utmParams ? JSON.parse(row.utmParams) : null,
      gtm_container_id: row.gtmContainerId || null,
      redirect_rules: row.redirectRules ? JSON.parse(row.redirectRules) : null,
    } : {}),
  };
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
  if (input.gradient) { style.gradient = input.gradient; hasStyle = true; }
  if (input.frame_style && input.frame_style !== "none") { style.frame_style = input.frame_style as QrStyleOptions["frame_style"]; hasStyle = true; }
  if (input.frame_text) { style.frame_text = input.frame_text; hasStyle = true; }
  if (input.frame_color) { style.frame_color = input.frame_color; hasStyle = true; }
  if (input.frame_text_color) { style.frame_text_color = input.frame_text_color; hasStyle = true; }
  if (input.frame_border_radius !== undefined) { style.frame_border_radius = input.frame_border_radius; hasStyle = true; }

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
  const customDomain = getCustomDomain(apiKeyId);
  const shortUrl = buildShortUrl(shortId, customDomain);
  const type = input.type || "url";

  // Determine QR matrix content and storage values based on type
  let targetUrl: string;
  let typeData: string | null = null;

  const typeDataMap: Record<string, unknown> = {
    vcard: input.vcard_data,
    wifi: input.wifi_data,
    email: input.email_data,
    sms: input.sms_data,
    phone: input.phone_data,
    event: input.event_data,
    text: input.text_data,
    location: input.location_data,
    social: input.social_data,
    app_store: input.app_store_data,
  };

  if (type === "url") {
    targetUrl = input.target_url!;
  } else {
    typeData = JSON.stringify(typeDataMap[type]);
    targetUrl = shortUrl; // sentinel — redirect route handles type-specific behavior
  }

  const qrContent = getQrContent(type, shortUrl, typeData);
  const styleOptions = buildStyleOptions(input);
  const imageData = await renderQrCode(qrContent, format, styleOptions);

  const inserted = db
    .insert(qrCodes)
    .values({
      shortId,
      targetUrl,
      label: input.label || null,
      format,
      styleOptions: styleOptions ? JSON.stringify(styleOptions) : null,
      apiKeyId,
      type,
      typeData,
      expiresAt: type === "url" ? (input.expires_at || null) : null,
      scheduledUrl: type === "url" ? (input.scheduled_url || null) : null,
      scheduledAt: type === "url" ? (input.scheduled_at || null) : null,
      utmParams: type === "url" && input.utm_params ? JSON.stringify(input.utm_params) : null,
      gtmContainerId: type === "url" ? (input.gtm_container_id || null) : null,
      redirectRules: type === "url" && input.redirect_rules ? JSON.stringify(input.redirect_rules) : null,
    })
    .returning()
    .get();

  return {
    ...formatQrResponse(inserted, customDomain),
    image_data: imageData,
  };
}

export function getQrCode(shortId: string, apiKeyId: number) {
  const row = db
    .select()
    .from(qrCodes)
    .where(and(eq(qrCodes.shortId, shortId), eq(qrCodes.apiKeyId, apiKeyId)))
    .get();

  if (!row) return null;

  const customDomain = getCustomDomain(apiKeyId);
  return formatQrResponse(row, customDomain);
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

  const customDomain = getCustomDomain(apiKeyId);
  return {
    data: rows.map((row) => formatQrResponse(row, customDomain)),
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

  const type = (existing.type as QrType) || "url";
  const updateSet: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  // Label is valid for all types
  if (input.label !== undefined) updateSet.label = input.label;

  // URL-specific fields
  if (type === "url") {
    if (input.target_url !== undefined) updateSet.targetUrl = input.target_url;
    if (input.expires_at !== undefined) updateSet.expiresAt = input.expires_at;
    if (input.scheduled_url !== undefined) updateSet.scheduledUrl = input.scheduled_url;
    if (input.scheduled_at !== undefined) updateSet.scheduledAt = input.scheduled_at;
    if (input.utm_params !== undefined) updateSet.utmParams = input.utm_params ? JSON.stringify(input.utm_params) : null;
    if (input.gtm_container_id !== undefined) updateSet.gtmContainerId = input.gtm_container_id;
    if (input.redirect_rules !== undefined) updateSet.redirectRules = input.redirect_rules ? JSON.stringify(input.redirect_rules) : null;
  }

  // Type-specific data: merge partial updates into existing typeData
  const typeDataKey = `${type}_data` as keyof UpdateQrInput;
  const inputData = input[typeDataKey] as Record<string, unknown> | undefined;
  if (type !== "url" && inputData) {
    const current = existing.typeData ? JSON.parse(existing.typeData) : {};
    updateSet.typeData = JSON.stringify({ ...current, ...inputData });
  }

  const updated = db
    .update(qrCodes)
    .set(updateSet)
    .where(eq(qrCodes.shortId, shortId))
    .returning()
    .get();

  const customDomain = getCustomDomain(apiKeyId);
  return formatQrResponse(updated, customDomain);
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
  const customDomainForImage = row.apiKeyId ? getCustomDomain(row.apiKeyId) : null;
  const shortUrl = buildShortUrl(row.shortId, customDomainForImage);
  const type = (row.type as QrType) || "url";
  const qrContent = getQrContent(type, shortUrl, row.typeData);
  const styleOptions: QrStyleOptions | undefined = row.styleOptions
    ? JSON.parse(row.styleOptions)
    : undefined;

  const imageData = await renderQrCode(qrContent, format, styleOptions);

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

  const customDomain = getCustomDomain(apiKeyId);
  const results = [];
  for (const input of items) {
    const shortId = nanoid(config.shortId.length);
    const format = input.format || "svg";
    const shortUrl = buildShortUrl(shortId, customDomain);
    const type = input.type || "url";

    let targetUrl: string;
    let typeData: string | null = null;

    const typeDataMap: Record<string, unknown> = {
      vcard: input.vcard_data, wifi: input.wifi_data, email: input.email_data,
      sms: input.sms_data, phone: input.phone_data, event: input.event_data,
      text: input.text_data, location: input.location_data, social: input.social_data,
      app_store: input.app_store_data,
    };

    if (type === "url") {
      targetUrl = input.target_url!;
    } else {
      typeData = JSON.stringify(typeDataMap[type]);
      targetUrl = shortUrl;
    }

    const qrContent = getQrContent(type, shortUrl, typeData);
    const styleOptions = buildStyleOptions(input);
    const imageData = await renderQrCode(qrContent, format, styleOptions);

    const inserted = db
      .insert(qrCodes)
      .values({
        shortId,
        targetUrl,
        label: input.label || null,
        format,
        styleOptions: styleOptions ? JSON.stringify(styleOptions) : null,
        apiKeyId,
        type,
        typeData,
        expiresAt: type === "url" ? (input.expires_at || null) : null,
        scheduledUrl: type === "url" ? (input.scheduled_url || null) : null,
        scheduledAt: type === "url" ? (input.scheduled_at || null) : null,
        utmParams: type === "url" && input.utm_params ? JSON.stringify(input.utm_params) : null,
        gtmContainerId: type === "url" ? (input.gtm_container_id || null) : null,
        redirectRules: type === "url" && input.redirect_rules ? JSON.stringify(input.redirect_rules) : null,
      })
      .returning()
      .get();

    results.push({
      ...formatQrResponse(inserted, customDomain),
      image_data: imageData,
    });
  }

  return { created: results.length, items: results };
}

export function bulkUpdateQrCodes(
  items: Array<{ short_id: string; target_url?: string; label?: string; [key: string]: unknown }>,
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

    const type = (existing.type as QrType) || "url";
    const updateSet: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (item.label !== undefined) updateSet.label = item.label;

    if (type === "url") {
      if (item.target_url !== undefined) updateSet.targetUrl = item.target_url;
      if (item.expires_at !== undefined) updateSet.expiresAt = item.expires_at;
      if (item.scheduled_url !== undefined) updateSet.scheduledUrl = item.scheduled_url;
      if (item.scheduled_at !== undefined) updateSet.scheduledAt = item.scheduled_at;
      if (item.utm_params !== undefined) updateSet.utmParams = item.utm_params ? JSON.stringify(item.utm_params) : null;
      if (item.gtm_container_id !== undefined) updateSet.gtmContainerId = item.gtm_container_id;
      if (item.redirect_rules !== undefined) updateSet.redirectRules = item.redirect_rules ? JSON.stringify(item.redirect_rules) : null;
    }
    // Type-specific data: merge partial updates
    const typeDataKey = `${type}_data`;
    const itemData = item[typeDataKey];
    if (type !== "url" && itemData && typeof itemData === "object") {
      const current = existing.typeData ? JSON.parse(existing.typeData) : {};
      updateSet.typeData = JSON.stringify({ ...current, ...itemData as object });
    }

    db.update(qrCodes)
      .set(updateSet)
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
