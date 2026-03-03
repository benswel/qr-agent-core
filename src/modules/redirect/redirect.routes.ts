import type { FastifyInstance } from "fastify";
import { eq, and, gt, count } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { recordScan } from "./redirect.service.js";
import { parseRequest, applyUtmParams, evaluateRules, buildGtmPage } from "./redirect.utils.js";
import { dispatchScannedEvent } from "../webhooks/webhooks.service.js";
import { buildVCardString, buildWiFiString, buildEmailString, buildIcsFile } from "../qr/qr.content.js";
import { sendError, Errors } from "../../shared/errors.js";
import { PLAN_LIMITS } from "../../shared/types.js";
import type { Plan, QrType, VCardData, WiFiData, EmailData, SMSData, PhoneData, EventData, TextData, LocationData, SocialData, AppStoreData, UtmParams, RedirectRule } from "../../shared/types.js";

const { qrCodes, scanEvents, apiKeys } = schema;

export async function redirectRoutes(app: FastifyInstance) {
  // Short URL redirect: /r/:shortId → target_url
  app.get(
    "/r/:shortId",
    {
      config: {
        rateLimit: {
          max: 500,
          timeWindow: "1 minute",
        },
      },
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

      // Parse request once (reused for rules + scan recording)
      const parsed = parseRequest(
        request.headers["user-agent"],
        request.ip,
        request.headers["accept-language"]
      );

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

      // Record the scan (fire-and-forget, pass pre-parsed data) — skip if over quota
      if (shouldRecord) {
        recordScan(row.id, scanData, parsed);
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

      if (type === "email" && row.typeData) {
        const data: EmailData = JSON.parse(row.typeData);
        const mailto = buildEmailString(data);
        return reply.redirect(mailto);
      }

      if (type === "sms" && row.typeData) {
        const data: SMSData = JSON.parse(row.typeData);
        const smsUrl = `sms:${data.phone_number}${data.message ? "?body=" + encodeURIComponent(data.message) : ""}`;
        return reply.redirect(smsUrl);
      }

      if (type === "phone" && row.typeData) {
        const data: PhoneData = JSON.parse(row.typeData);
        return reply.redirect(`tel:${data.phone_number}`);
      }

      if (type === "event" && row.typeData) {
        const data: EventData = JSON.parse(row.typeData);
        const ics = buildIcsFile(data);
        return reply
          .type("text/calendar")
          .header("Content-Disposition", 'attachment; filename="event.ics"')
          .send(ics);
      }

      if (type === "text" && row.typeData) {
        const data: TextData = JSON.parse(row.typeData);
        return reply.send({ type: "text", content: data.content });
      }

      if (type === "location" && row.typeData) {
        const data: LocationData = JSON.parse(row.typeData);
        const label = data.label ? encodeURIComponent(data.label) : "";
        return reply.redirect(`https://www.google.com/maps?q=${data.latitude},${data.longitude}${label ? "&label=" + label : ""}`);
      }

      if (type === "social" && row.typeData) {
        const data: SocialData = JSON.parse(row.typeData);
        return reply.send({ type: "social", platforms: data });
      }

      if (type === "app_store" && row.typeData) {
        const data: AppStoreData = JSON.parse(row.typeData);
        const ua = request.headers["user-agent"] || "";
        if (/iPhone|iPad|iPod/i.test(ua) && data.ios_url) return reply.redirect(data.ios_url);
        if (/Android/i.test(ua) && data.android_url) return reply.redirect(data.android_url);
        if (data.fallback_url) return reply.redirect(data.fallback_url);
        return reply.send({ type: "app_store", ios_url: data.ios_url, android_url: data.android_url });
      }

      // --- URL type: apply rules → UTM → GTM page or 302 ---

      let finalUrl = targetUrl;

      // Evaluate conditional redirect rules (top-to-bottom, first match wins)
      if (row.redirectRules) {
        const rules: RedirectRule[] = JSON.parse(row.redirectRules);
        const ruleMatch = evaluateRules(rules, parsed);
        if (ruleMatch) finalUrl = ruleMatch;
      }

      // Append UTM parameters
      if (row.utmParams) {
        const utm: UtmParams = JSON.parse(row.utmParams);
        finalUrl = applyUtmParams(finalUrl, utm);
      }

      // GTM intermediate page or direct 302
      if (row.gtmContainerId) {
        const html = buildGtmPage(finalUrl, row.gtmContainerId);
        return reply.type("text/html").send(html);
      }

      return reply.redirect(finalUrl);
    }
  );
}
