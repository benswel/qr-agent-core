import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { sendError, Errors } from "../../shared/errors.js";
import { recordConversion, getConversions } from "./conversions.service.js";
import { dispatchConversionEvent } from "../webhooks/webhooks.service.js";
import {
  conversionRecordSchema,
  conversionStatsSchema,
  conversionPixelSchema,
} from "./conversions.schemas.js";

const { qrCodes } = schema;

// 1×1 transparent GIF (43 bytes)
const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/**
 * Public tracking pixel route — registered at root level (no /api prefix).
 * GET /t/:shortId?event=purchase&value=49.99
 */
export async function conversionPixelRoutes(app: FastifyInstance) {
  app.get(
    "/t/:shortId",
    {
      schema: {
        ...conversionPixelSchema,
        tags: ["Conversions"],
        summary: "Tracking pixel — record a conversion via image embed",
        description:
          'Embed as <img src="https://yourhost/t/abc123?event=purchase&value=49.99"> in confirmation pages. Returns a 1×1 transparent GIF. No authentication required.',
        hide: true,
      },
    },
    async (request, reply) => {
      const { shortId } = request.params as { shortId: string };
      const { event, value, meta } = request.query as {
        event?: string;
        value?: number;
        meta?: string;
      };

      if (!event) {
        return reply.status(400).send({
          error: "Missing required query parameter: event",
          code: "MISSING_EVENT",
          hint: 'Add ?event=purchase (or any event name) to the pixel URL. Example: /t/abc123?event=purchase&value=49.99',
        });
      }

      const qr = db
        .select()
        .from(qrCodes)
        .where(eq(qrCodes.shortId, shortId))
        .get();

      if (!qr) {
        // Still return the pixel (don't leak info)
        return reply
          .type("image/gif")
          .header("Cache-Control", "no-store")
          .send(PIXEL_GIF);
      }

      // Parse metadata if provided
      let metadata: Record<string, unknown> | null = null;
      if (meta) {
        try {
          metadata = JSON.parse(meta);
        } catch {
          // Ignore invalid meta
        }
      }

      // Record the conversion
      recordConversion({
        qrCodeId: qr.id,
        eventName: event,
        value: value ?? null,
        metadata,
        referer: request.headers["referer"] ?? null,
        ip: request.ip,
      });

      // Dispatch webhook (fire-and-forget)
      if (qr.apiKeyId) {
        dispatchConversionEvent(
          qr.shortId,
          event,
          value ?? null,
          metadata,
          qr.apiKeyId
        ).catch(() => {});
      }

      return reply
        .type("image/gif")
        .header("Cache-Control", "no-store")
        .send(PIXEL_GIF);
    }
  );
}

/**
 * Authenticated conversion API routes — registered with prefix /api/conversions.
 */
export async function conversionsRoutes(app: FastifyInstance) {
  // POST /api/conversions — record conversion
  app.post(
    "/",
    {
      schema: {
        ...conversionRecordSchema,
        tags: ["Conversions"],
        summary: "Record a conversion event",
        description:
          "Record a post-scan conversion (purchase, signup, etc.) for a QR code you own. Use this for server-side tracking. For client-side, use the tracking pixel at GET /t/:shortId.",
      },
    },
    async (request, reply) => {
      const body = request.body as {
        short_id: string;
        event: string;
        value?: number;
        metadata?: Record<string, unknown>;
      };

      // Find QR code owned by this API key
      const qr = db
        .select()
        .from(qrCodes)
        .where(
          and(
            eq(qrCodes.shortId, body.short_id),
            eq(qrCodes.apiKeyId, request.apiKeyId)
          )
        )
        .get();

      if (!qr) {
        return sendError(reply, 404, Errors.notFound("QR code", body.short_id));
      }

      const result = recordConversion({
        qrCodeId: qr.id,
        eventName: body.event,
        value: body.value ?? null,
        metadata: body.metadata ?? null,
        referer: request.headers["referer"] ?? null,
        ip: request.ip,
      });

      // Dispatch webhook (fire-and-forget)
      if (qr.apiKeyId) {
        dispatchConversionEvent(
          qr.shortId,
          body.event,
          body.value ?? null,
          body.metadata ?? null,
          qr.apiKeyId
        ).catch(() => {});
      }

      return reply.status(201).send({
        ...result,
        short_id: body.short_id,
      });
    }
  );

  // GET /api/conversions/:shortId — conversion stats
  app.get(
    "/:shortId",
    {
      schema: {
        ...conversionStatsSchema,
        tags: ["Conversions"],
        summary: "Get conversion statistics for a QR code",
        description:
          "Returns conversion totals, breakdowns by event name, daily trends, and recent events. Filter by period and event name.",
      },
    },
    async (request, reply) => {
      const { shortId } = request.params as { shortId: string };
      const { period = "30d", event } = request.query as {
        period?: string;
        event?: string;
      };

      const qr = db
        .select()
        .from(qrCodes)
        .where(
          and(
            eq(qrCodes.shortId, shortId),
            eq(qrCodes.apiKeyId, request.apiKeyId)
          )
        )
        .get();

      if (!qr) {
        return sendError(reply, 404, Errors.notFound("QR code", shortId));
      }

      return getConversions(qr.id, shortId, period, event);
    }
  );
}
