import type { FastifyInstance } from "fastify";
import { eq, and, gt, count } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { recordScan } from "./redirect.service.js";
import { dispatchScannedEvent } from "../webhooks/webhooks.service.js";
import { buildVCardString, buildWiFiString } from "../qr/qr.content.js";
import { sendError, Errors } from "../../shared/errors.js";
import { PLAN_LIMITS } from "../../shared/types.js";
import type { Plan, QrType, VCardData, WiFiData } from "../../shared/types.js";

const { qrCodes, scanEvents, apiKeys } = schema;

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
          "This is the endpoint encoded in every QR code. When scanned, it records a scan event, dispatches webhook notifications, and performs a 302 redirect to the current target_url. Agents should NOT call this directly — use the QR Codes API instead.",
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

      // Check expiration
      if (row.expiresAt && new Date(row.expiresAt) <= new Date()) {
        return reply.code(410).send({
          error: "QR code has expired",
          code: "QR_EXPIRED",
          expired_at: row.expiresAt,
          hint: "This QR code is no longer active. The owner can remove or extend the expiration via the API.",
        });
      }

      // Lazy scheduled URL swap
      let targetUrl = row.targetUrl;
      if (row.scheduledUrl && row.scheduledAt && new Date(row.scheduledAt) <= new Date()) {
        db.update(qrCodes)
          .set({
            targetUrl: row.scheduledUrl,
            scheduledUrl: null,
            scheduledAt: null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(qrCodes.id, row.id))
          .run();
        targetUrl = row.scheduledUrl;
      }

      const scanData = {
        userAgent: request.headers["user-agent"],
        referer: request.headers["referer"],
        ip: request.ip,
      };

      // Check scan quota before recording
      let shouldRecord = true;
      if (row.apiKeyId) {
        const keyRow = db
          .select({ plan: apiKeys.plan })
          .from(apiKeys)
          .where(eq(apiKeys.id, row.apiKeyId))
          .get();

        const plan = (keyRow?.plan as Plan) || "free";
        const limits = PLAN_LIMITS[plan];
        const hardLimit = limits.maxScansPerMonth + limits.scanGracePeriod;

        if (hardLimit !== Infinity) {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const [{ total }] = db
            .select({ total: count() })
            .from(scanEvents)
            .innerJoin(qrCodes, eq(scanEvents.qrCodeId, qrCodes.id))
            .where(
              and(
                eq(qrCodes.apiKeyId, row.apiKeyId),
                gt(scanEvents.scannedAt, thirtyDaysAgo)
              )
            )
            .all();

          if (total >= hardLimit) {
            shouldRecord = false;
          }
        }
      }

      // Record the scan (fire-and-forget) — skip if over quota
      if (shouldRecord) {
        recordScan(row.id, scanData);
      }

      // Dispatch webhook notifications (fire-and-forget)
      if (row.apiKeyId) {
        dispatchScannedEvent(
          row.shortId,
          row.targetUrl,
          row.label,
          {
            user_agent: scanData.userAgent,
            referer: scanData.referer,
            ip: scanData.ip,
            scanned_at: new Date().toISOString(),
          },
          row.apiKeyId
        ).catch(() => {
          // Webhook delivery failures are logged in webhook_deliveries table, don't block redirect
        });
      }

      // Type-specific response
      const type = (row.type as QrType) || "url";

      if (type === "vcard" && row.typeData) {
        const data: VCardData = JSON.parse(row.typeData);
        const vcf = buildVCardString(data);
        return reply
          .type("text/vcard")
          .header("Content-Disposition", `attachment; filename="${data.first_name}_${data.last_name}.vcf"`)
          .send(vcf);
      }

      if (type === "wifi" && row.typeData) {
        const data: WiFiData = JSON.parse(row.typeData);
        return reply.send({
          type: "wifi",
          ssid: data.ssid,
          encryption: data.encryption,
          hidden: data.hidden || false,
          hint: "This QR code contains WiFi credentials. Scan the QR image directly with your phone camera to auto-join the network.",
        });
      }

      return reply.redirect(targetUrl);
    }
  );
}
