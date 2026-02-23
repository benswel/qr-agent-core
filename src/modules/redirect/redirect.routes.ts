import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { recordScan } from "./redirect.service.js";
import { sendError, Errors } from "../../shared/errors.js";

const { qrCodes } = schema;

export async function redirectRoutes(app: FastifyInstance) {
  // Short URL redirect: /r/:shortId → target_url
  app.get(
    "/r/:shortId",
    {
      schema: {
        params: {
          type: "object" as const,
          properties: {
            shortId: { type: "string" },
          },
        },
        tags: ["Redirect"],
        summary: "Redirect a short URL to its target",
        description:
          "This is the endpoint encoded in every QR code. When scanned, it records a scan event and performs a 302 redirect to the current target_url. Agents should NOT call this directly — use the QR Codes API instead.",
        hide: true,
      },
    },
    async (request, reply) => {
      const { shortId } = request.params as { shortId: string };

      const row = db
        .select()
        .from(qrCodes)
        .where(eq(qrCodes.shortId, shortId))
        .get();

      if (!row) {
        return sendError(reply, 404, Errors.notFound("Short URL", shortId));
      }

      // Record the scan asynchronously (fire-and-forget)
      recordScan(row.id, {
        userAgent: request.headers["user-agent"],
        referer: request.headers["referer"],
        ip: request.ip,
      });

      return reply.redirect(row.targetUrl);
    }
  );
}
