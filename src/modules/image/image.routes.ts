import type { FastifyInstance } from "fastify";
import * as qrService from "../qr/qr.service.js";
import { sendError, Errors } from "../../shared/errors.js";

/**
 * Public image endpoint — no authentication required.
 * Designed for embedding QR images directly in HTML:
 *   <img src="https://your-server/i/abc123" />
 */
export async function imageRoutes(app: FastifyInstance) {
  app.get(
    "/i/:shortId",
    {
      schema: {
        params: {
          type: "object" as const,
          required: ["shortId"],
          properties: {
            shortId: { type: "string" },
          },
        },
        querystring: {
          type: "object" as const,
          properties: {
            format: {
              type: "string",
              enum: ["svg", "png"],
            },
          },
        },
        tags: ["QR Codes"],
        summary: "Public QR code image (no auth)",
        description:
          'Returns the QR code image without authentication. Use this URL in <img> tags, emails, or anywhere you need to embed the QR image publicly. Example: <img src="/i/abc123" />',
      },
    },
    async (request, reply) => {
      const { shortId } = request.params as { shortId: string };
      const { format } = request.query as { format?: "svg" | "png" };

      const result = await qrService.getQrImage(shortId, format);

      if (!result) {
        return sendError(reply, 404, Errors.notFound("QR code", shortId));
      }

      // Cache for 24 hours — the QR image never changes (it encodes the short URL, not the destination)
      reply.header("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");

      if (result.format === "svg") {
        return reply
          .type("image/svg+xml")
          .header("Content-Disposition", `inline; filename="${shortId}.svg"`)
          .send(result.imageData);
      }

      const base64Data = result.imageData.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      return reply
        .type("image/png")
        .header("Content-Disposition", `inline; filename="${shortId}.png"`)
        .send(buffer);
    }
  );
}
