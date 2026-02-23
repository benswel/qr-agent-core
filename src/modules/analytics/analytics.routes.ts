import type { FastifyInstance } from "fastify";
import { eq, and, count, sql } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { sendError, Errors } from "../../shared/errors.js";

const { qrCodes, scanEvents } = schema;

export async function analyticsRoutes(app: FastifyInstance) {
  // GET scan analytics for a specific QR code
  app.get(
    "/:shortId",
    {
      schema: {
        params: {
          type: "object" as const,
          required: ["shortId"],
          properties: {
            shortId: {
              type: "string",
              description: "The short_id of the QR code to get analytics for.",
            },
          },
        },
        tags: ["Analytics"],
        summary: "Get scan analytics for a QR code",
        description:
          "Returns aggregated scan statistics and recent scan events for a given QR code owned by the authenticated API key. Useful for agents tracking campaign performance or measuring engagement.",
      },
    },
    async (request, reply) => {
      const { shortId } = request.params as { shortId: string };

      // Verify the QR code belongs to this API key
      const qr = db
        .select()
        .from(qrCodes)
        .where(and(eq(qrCodes.shortId, shortId), eq(qrCodes.apiKeyId, request.apiKeyId)))
        .get();

      if (!qr) {
        return sendError(reply, 404, Errors.notFound("QR code", shortId));
      }

      const [{ totalScans }] = db
        .select({ totalScans: count() })
        .from(scanEvents)
        .where(eq(scanEvents.qrCodeId, qr.id))
        .all();

      const recentScans = db
        .select()
        .from(scanEvents)
        .where(eq(scanEvents.qrCodeId, qr.id))
        .orderBy(sql`${scanEvents.scannedAt} DESC`)
        .limit(50)
        .all();

      return {
        short_id: shortId,
        total_scans: totalScans,
        recent_scans: recentScans.map((s) => ({
          scanned_at: s.scannedAt,
          user_agent: s.userAgent,
          referer: s.referer,
        })),
      };
    }
  );
}
