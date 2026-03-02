import type { FastifyInstance } from "fastify";
import {
  qrCreateSchema,
  qrListSchema,
  qrGetSchema,
  qrUpdateSchema,
  qrDeleteSchema,
  qrBulkCreateSchema,
  qrBulkUpdateSchema,
  qrBulkDeleteSchema,
} from "./qr.schemas.js";
import * as qrService from "./qr.service.js";
import { sendError, Errors } from "../../shared/errors.js";

/** Validate type-specific required fields. Returns an error object or null if valid. */
function validateQrTypeFields(type: string, body: Record<string, unknown>) {
  if (type === "url") {
    if (!body.target_url) return Errors.missingField("target_url", "Required when type is 'url' (default).");
    try { new URL(body.target_url as string); } catch { return Errors.invalidUrl(body.target_url as string); }
  } else if (type === "vcard") {
    const d = body.vcard_data as Record<string, unknown> | undefined;
    if (!d || !d.first_name || !d.last_name) return Errors.missingField("vcard_data", "Required with first_name and last_name when type is 'vcard'.");
  } else if (type === "wifi") {
    const d = body.wifi_data as Record<string, unknown> | undefined;
    if (!d || !d.ssid) return Errors.missingField("wifi_data", "Required with ssid when type is 'wifi'.");
  } else if (type === "email") {
    const d = body.email_data as Record<string, unknown> | undefined;
    if (!d || !d.to) return Errors.missingField("email_data", "Required with 'to' when type is 'email'.");
  } else if (type === "sms") {
    const d = body.sms_data as Record<string, unknown> | undefined;
    if (!d || !d.phone_number) return Errors.missingField("sms_data", "Required with phone_number when type is 'sms'.");
  } else if (type === "phone") {
    const d = body.phone_data as Record<string, unknown> | undefined;
    if (!d || !d.phone_number) return Errors.missingField("phone_data", "Required with phone_number when type is 'phone'.");
  } else if (type === "event") {
    const d = body.event_data as Record<string, unknown> | undefined;
    if (!d || !d.summary || !d.start || !d.end) return Errors.missingField("event_data", "Required with summary, start, and end when type is 'event'.");
  } else if (type === "text") {
    const d = body.text_data as Record<string, unknown> | undefined;
    if (!d || !d.content) return Errors.missingField("text_data", "Required with content when type is 'text'.");
  } else if (type === "location") {
    const d = body.location_data as Record<string, unknown> | undefined;
    if (!d || d.latitude == null || d.longitude == null) return Errors.missingField("location_data", "Required with latitude and longitude when type is 'location'.");
  } else if (type === "social") {
    const d = body.social_data as Record<string, unknown> | undefined;
    if (!d || !Object.values(d).some(v => v)) return Errors.missingField("social_data", "At least one platform link is required when type is 'social'.");
  } else if (type === "app_store") {
    const d = body.app_store_data as Record<string, unknown> | undefined;
    if (!d || (!d.ios_url && !d.android_url)) return Errors.missingField("app_store_data", "At least ios_url or android_url is required when type is 'app_store'.");
  }
  return null;
}

const VALID_CONDITION_TYPES = new Set(["device", "os", "country", "language", "time_range", "ab_split"]);

/** Validate redirect_rules target URLs and condition types */
function validateRedirectRules(rules: unknown[]): ReturnType<typeof Errors.missingField> | null {
  for (const rule of rules) {
    const r = rule as Record<string, unknown>;
    if (!r.target_url) return Errors.missingField("redirect_rules[].target_url", "Each rule must have a target_url.");
    try { new URL(r.target_url as string); } catch { return Errors.invalidUrl(r.target_url as string); }
    const cond = r.condition as Record<string, unknown> | undefined;
    if (!cond || !cond.type || !VALID_CONDITION_TYPES.has(cond.type as string)) {
      return Errors.missingField("redirect_rules[].condition.type", "Must be one of: device, os, country, language, time_range, ab_split.");
    }
  }
  return null;
}

export async function qrRoutes(app: FastifyInstance) {
  // CREATE a new QR code
  app.post(
    "/",
    {
      schema: {
        ...qrCreateSchema,
        tags: ["QR Codes"],
        summary: "Create a new managed QR code",
        description:
          "Generates a QR code that points to a short URL managed by this service. The short URL redirects to the target_url, which can be updated later without changing the QR image. Returns the QR image data inline. Supports custom styling: colors, dot shapes, corner shapes, and logo embedding.",
      },
    },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const type = (body.type as string) || "url";

      // Conditional validation based on type
      const validationError = validateQrTypeFields(type, body);
      if (validationError) {
        return sendError(reply, 400, validationError);
      }

      // Validate redirect_rules if provided
      if (body.redirect_rules && Array.isArray(body.redirect_rules)) {
        const rulesError = validateRedirectRules(body.redirect_rules);
        if (rulesError) return sendError(reply, 400, rulesError);
      }

      const result = await qrService.createQrCode(body as any, request.apiKeyId, request.plan);

      if ("error" in result && result.error === "QR_CODE_LIMIT_REACHED") {
        return sendError(reply, 403, Errors.qrCodeLimitReached(result.limit));
      }

      return reply.status(201).send(result);
    }
  );

  // LIST all QR codes
  app.get(
    "/",
    {
      schema: {
        ...qrListSchema,
        tags: ["QR Codes"],
        summary: "List all managed QR codes",
        description:
          "Returns a paginated list of all QR codes owned by the authenticated API key. Use limit and offset query parameters for pagination. Does not include image data — use GET /api/qr/:shortId for full details.",
      },
    },
    async (request) => {
      const query = request.query as { limit?: number; offset?: number };
      return qrService.listQrCodes(query.limit, query.offset, request.apiKeyId);
    }
  );

  // GET a single QR code
  app.get(
    "/:shortId",
    {
      schema: {
        ...qrGetSchema,
        tags: ["QR Codes"],
        summary: "Get a QR code by its short ID",
        description:
          "Retrieves full details of a QR code owned by the authenticated API key, including its current target URL and metadata. Does not include image_data — to regenerate the image, create a new QR code.",
      },
    },
    async (request, reply) => {
      const { shortId } = request.params as { shortId: string };
      const result = qrService.getQrCode(shortId, request.apiKeyId);

      if (!result) {
        return sendError(reply, 404, Errors.notFound("QR code", shortId));
      }

      return result;
    }
  );

  // UPDATE a QR code's target URL or label
  app.patch(
    "/:shortId",
    {
      schema: {
        ...qrUpdateSchema,
        tags: ["QR Codes"],
        summary: "Update a QR code's target URL or label",
        description:
          "Modifies the target_url or label of an existing QR code owned by the authenticated API key. This is the core 'dynamic link' feature: the QR image itself doesn't change, but the destination it redirects to does. This is ideal for printed QR codes that need to point to different content over time.",
      },
    },
    async (request, reply) => {
      const { shortId } = request.params as { shortId: string };
      const body = request.body as Record<string, unknown>;

      if (body.target_url) {
        try {
          new URL(body.target_url as string);
        } catch {
          return sendError(reply, 400, Errors.invalidUrl(body.target_url as string));
        }
      }

      // Validate redirect_rules if provided
      if (body.redirect_rules && Array.isArray(body.redirect_rules)) {
        const rulesError = validateRedirectRules(body.redirect_rules);
        if (rulesError) return sendError(reply, 400, rulesError);
      }

      const result = qrService.updateQrCode(shortId, body as any, request.apiKeyId);

      if (!result) {
        return sendError(reply, 404, Errors.notFound("QR code", shortId));
      }

      return result;
    }
  );

  // DELETE a QR code
  app.delete(
    "/:shortId",
    {
      schema: {
        ...qrDeleteSchema,
        tags: ["QR Codes"],
        summary: "Delete a QR code and all its analytics",
        description:
          "Permanently removes a QR code owned by the authenticated API key and all associated scan events. The short URL will stop working immediately. This action cannot be undone.",
      },
    },
    async (request, reply) => {
      const { shortId } = request.params as { shortId: string };
      const deleted = qrService.deleteQrCode(shortId, request.apiKeyId);

      if (!deleted) {
        return sendError(reply, 404, Errors.notFound("QR code", shortId));
      }

      return reply.status(200).send({
        deleted: true,
        short_id: shortId,
        message: "QR code and all associated scan events have been permanently deleted.",
      });
    }
  );

  // ---- Bulk operations ----

  // BULK CREATE QR codes
  app.post(
    "/bulk",
    {
      schema: {
        ...qrBulkCreateSchema,
        tags: ["QR Codes"],
        summary: "Create multiple QR codes in one request",
        description:
          "Create up to 50 QR codes in a single request. Each item supports the same options as POST /api/qr. The quota check is all-or-nothing: if the batch would exceed your plan limit, no QR codes are created.",
      },
    },
    async (request, reply) => {
      const body = request.body as { items: Array<Record<string, unknown>> };

      // Validate each item based on type
      for (const item of body.items) {
        const itemType = (item.type as string) || "url";
        const validationError = validateQrTypeFields(itemType, item);
        if (validationError) {
          return sendError(reply, 400, validationError);
        }
        if (item.redirect_rules && Array.isArray(item.redirect_rules)) {
          const rulesError = validateRedirectRules(item.redirect_rules);
          if (rulesError) return sendError(reply, 400, rulesError);
        }
      }

      const result = await qrService.bulkCreateQrCodes(
        body.items as any,
        request.apiKeyId,
        request.plan
      );

      if ("error" in result && result.error === "QR_CODE_LIMIT_REACHED") {
        return sendError(reply, 403, Errors.bulkQrCodeLimitReached(result.limit, result.existing, result.requested));
      }

      return reply.status(201).send(result);
    }
  );

  // BULK UPDATE QR codes
  app.patch(
    "/bulk",
    {
      schema: {
        ...qrBulkUpdateSchema,
        tags: ["QR Codes"],
        summary: "Update multiple QR codes in one request",
        description:
          "Update up to 50 QR codes in a single request. Each item requires short_id plus target_url and/or label. Items with non-existent short_id are reported as not_found (no error thrown).",
      },
    },
    async (request, reply) => {
      const body = request.body as { items: Array<{ short_id: string; target_url?: string; label?: string }> };

      // Validate URLs
      for (const item of body.items) {
        if (item.target_url) {
          try {
            new URL(item.target_url);
          } catch {
            return sendError(reply, 400, Errors.invalidUrl(item.target_url));
          }
        }
      }

      return qrService.bulkUpdateQrCodes(body.items, request.apiKeyId);
    }
  );

  // BULK DELETE QR codes
  app.delete(
    "/bulk",
    {
      schema: {
        ...qrBulkDeleteSchema,
        tags: ["QR Codes"],
        summary: "Delete multiple QR codes in one request",
        description:
          "Delete up to 50 QR codes and their scan analytics in a single request. Items with non-existent short_id are reported as not_found.",
      },
    },
    async (request, reply) => {
      const body = request.body as { short_ids: string[] };
      return qrService.bulkDeleteQrCodes(body.short_ids, request.apiKeyId);
    }
  );

  // GET QR code image (authenticated)
  app.get(
    "/:shortId/image",
    {
      schema: {
        params: {
          type: "object" as const,
          required: ["shortId"],
          properties: {
            shortId: {
              type: "string",
              description: "The short_id of the QR code.",
            },
          },
        },
        querystring: {
          type: "object" as const,
          properties: {
            format: {
              type: "string",
              enum: ["svg", "png"],
              description:
                'Override the original format. "svg" returns image/svg+xml, "png" returns image/png. If omitted, uses the format chosen at creation.',
            },
          },
        },
        tags: ["QR Codes"],
        summary: "Download the QR code image",
        description:
          "Returns the raw QR code image with the correct Content-Type header. Uses stored style options for regeneration. Supports format override via query parameter.",
      },
    },
    async (request, reply) => {
      const { shortId } = request.params as { shortId: string };
      const { format } = request.query as { format?: "svg" | "png" };

      const result = await qrService.getQrImage(shortId, format, request.apiKeyId);

      if (!result) {
        return sendError(reply, 404, Errors.notFound("QR code", shortId));
      }

      if (result.format === "svg") {
        return reply
          .type("image/svg+xml")
          .header("Content-Disposition", `inline; filename="${shortId}.svg"`)
          .send(result.imageData);
      }

      // PNG: imageData is a data URI, extract the base64 part
      const base64Data = result.imageData.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      return reply
        .type("image/png")
        .header("Content-Disposition", `inline; filename="${shortId}.png"`)
        .send(buffer);
    }
  );
}
