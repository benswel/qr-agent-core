import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, gt, gte, count, sql } from "drizzle-orm";
import { generateApiKey } from "./auth.service.js";
import { sendError } from "../../shared/errors.js";
import { PLAN_LIMITS } from "../../shared/types.js";
import { db, schema } from "../../db/index.js";
import { config } from "../../config/index.js";

const { apiKeys, qrCodes, scanEvents, webhooks, webhookDeliveries } = schema;

const registerBodySchema = z.object({
  email: z.string().email(),
  label: z.string().max(100).optional(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post(
    "/api/register",
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: "1 hour",
        },
      },
      schema: {
        tags: ["Auth"],
        summary: "Register for an API key",
        description:
          "Self-service endpoint to obtain an API key. Provide your email address and receive a key immediately. Store the key securely — it will not be shown again. Rate-limited to 3 requests per hour per IP.",
        body: {
          type: "object" as const,
          required: ["email"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "Your email address. Used to identify the key owner.",
            },
            label: {
              type: "string",
              maxLength: 100,
              description:
                "Optional human-readable label for this API key (e.g., your app name). Defaults to the email address if not provided.",
            },
          },
        },
        response: {
          201: {
            type: "object",
            description: "The newly created API key. Store it securely.",
            properties: {
              key: {
                type: "string",
                description:
                  "Your API key. Include it in the X-API-Key header for all authenticated requests.",
              },
              label: {
                type: "string",
                description: "The label associated with this key.",
              },
              message: {
                type: "string",
                description: "Important reminder about key storage.",
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = registerBodySchema.safeParse(request.body);

      if (!parsed.success) {
        return sendError(reply, 400, {
          error: "Invalid request body.",
          code: "VALIDATION_ERROR",
          hint: "Provide a valid email address in the 'email' field. Optionally include a 'label' (max 100 characters).",
        });
      }

      const { email, label } = parsed.data;
      const result = generateApiKey(label || email, email);

      return reply.status(201).send({
        key: result.key,
        label: result.label,
        message: "Store this key securely — it won't be shown again.",
      });
    }
  );

  // GET /api/usage — current usage for authenticated API key
  app.get(
    "/api/usage",
    {
      schema: {
        tags: ["Auth"],
        summary: "Get current usage and quota for your API key",
        description:
          "Returns current usage counts and plan limits for the authenticated API key. Use this to monitor quota consumption and determine when to upgrade.",
        response: {
          200: {
            type: "object",
            properties: {
              plan: { type: "string" },
              qr_codes: {
                type: "object",
                properties: {
                  used: { type: "number" },
                  limit: { type: ["number", "null"] },
                },
              },
              scans_this_month: {
                type: "object",
                properties: {
                  used: { type: "number" },
                  limit: { type: ["number", "null"] },
                  grace_remaining: { type: ["number", "null"] },
                },
              },
              webhooks: {
                type: "object",
                properties: {
                  used: { type: "number" },
                  limit: { type: ["number", "null"] },
                },
              },
              upgrade: {
                type: "object",
                properties: {
                  available: { type: "boolean" },
                  plan: { type: "string" },
                  price: { type: "string" },
                  hint: { type: "string" },
                },
              },
              billing: {
                type: "object",
                properties: {
                  hint: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const plan = request.plan;
      const limits = PLAN_LIMITS[plan];
      const apiKeyId = request.apiKeyId;

      // Count QR codes
      const [{ qrCount }] = db
        .select({ qrCount: count() })
        .from(qrCodes)
        .where(eq(qrCodes.apiKeyId, apiKeyId))
        .all();

      // Count scans in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [{ scanCount }] = db
        .select({ scanCount: count() })
        .from(scanEvents)
        .innerJoin(qrCodes, eq(scanEvents.qrCodeId, qrCodes.id))
        .where(
          and(
            eq(qrCodes.apiKeyId, apiKeyId),
            gt(scanEvents.scannedAt, thirtyDaysAgo)
          )
        )
        .all();

      // Count webhooks
      const [{ webhookCount }] = db
        .select({ webhookCount: count() })
        .from(webhooks)
        .where(eq(webhooks.apiKeyId, apiKeyId))
        .all();

      const hardLimit = limits.maxScansPerMonth + limits.scanGracePeriod;
      const graceRemaining = Math.max(0, hardLimit - Math.max(scanCount, limits.maxScansPerMonth));

      return {
        plan,
        qr_codes: {
          used: qrCount,
          limit: limits.maxQrCodes === Infinity ? null : limits.maxQrCodes,
        },
        scans_this_month: {
          used: scanCount,
          limit: limits.maxScansPerMonth === Infinity ? null : limits.maxScansPerMonth,
          grace_remaining: limits.scanGracePeriod === 0 ? null : graceRemaining,
        },
        webhooks: {
          used: webhookCount,
          limit: limits.maxWebhooks === Infinity ? null : limits.maxWebhooks,
        },
        ...(plan === "free"
          ? {
              upgrade: {
                available: true,
                plan: "pro",
                price: "$19/month",
                hint: "Use the upgrade_to_pro tool to subscribe, or visit https://qrforagent.com/pricing",
              },
            }
          : {
              billing: {
                hint: "Use the manage_billing tool to access the Stripe Customer Portal.",
              },
            }),
      };
    }
  );

  // --- Admin endpoints (protected by ADMIN_SECRET) ---

  function checkAdminSecret(request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) {
    if (!config.adminSecret) {
      return sendError(reply, 503, {
        error: "Admin endpoints are not configured.",
        code: "ADMIN_NOT_CONFIGURED",
        hint: "Set the ADMIN_SECRET environment variable on the server.",
      });
    }

    const provided = request.headers["x-admin-secret"];
    if (!provided || provided !== config.adminSecret) {
      return sendError(reply, 403, {
        error: "Invalid admin secret.",
        code: "ADMIN_FORBIDDEN",
        hint: "Provide the correct value in the X-Admin-Secret header.",
      });
    }
  }

  app.get(
    "/api/admin/keys",
    { schema: { tags: ["Admin"], summary: "List all registered API keys", hide: true } },
    async (request, reply) => {
      const denied = checkAdminSecret(request, reply);
      if (denied) return denied;

      const keys = db
        .select({
          id: apiKeys.id,
          label: apiKeys.label,
          email: apiKeys.email,
          plan: apiKeys.plan,
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
        })
        .from(apiKeys)
        .all();

      return { count: keys.length, keys };
    }
  );

  app.get(
    "/api/admin/stats",
    { schema: { tags: ["Admin"], summary: "Dashboard metrics", hide: true } },
    async (request, reply) => {
      const denied = checkAdminSecret(request, reply);
      if (denied) return denied;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Users by plan
      const planBreakdown = db
        .select({ plan: apiKeys.plan, total: count() })
        .from(apiKeys)
        .groupBy(apiKeys.plan)
        .all();

      const usersByPlan: Record<string, number> = {};
      let totalUsers = 0;
      for (const row of planBreakdown) {
        usersByPlan[row.plan] = row.total;
        totalUsers += row.total;
      }

      // Recent signups (last 7 days)
      const [{ recentSignups }] = db
        .select({ recentSignups: count() })
        .from(apiKeys)
        .where(gte(apiKeys.createdAt, sevenDaysAgo))
        .all();

      // Active users (used in last 7 days)
      const [{ activeUsers }] = db
        .select({ activeUsers: count() })
        .from(apiKeys)
        .where(gte(apiKeys.lastUsedAt, sevenDaysAgo))
        .all();

      // QR codes
      const [{ totalQr }] = db
        .select({ totalQr: count() })
        .from(qrCodes)
        .all();

      // Scans
      const [{ totalScans }] = db
        .select({ totalScans: count() })
        .from(scanEvents)
        .all();

      const [{ scansLast30d }] = db
        .select({ scansLast30d: count() })
        .from(scanEvents)
        .where(gte(scanEvents.scannedAt, thirtyDaysAgo))
        .all();

      // Webhooks
      const [{ totalWebhooks }] = db
        .select({ totalWebhooks: count() })
        .from(webhooks)
        .all();

      // Webhook deliveries last 30 days
      const [{ deliveriesLast30d }] = db
        .select({ deliveriesLast30d: count() })
        .from(webhookDeliveries)
        .where(gte(webhookDeliveries.deliveredAt, thirtyDaysAgo))
        .all();

      return {
        users: {
          total: totalUsers,
          by_plan: usersByPlan,
          signups_last_7d: recentSignups,
          active_last_7d: activeUsers,
        },
        qr_codes: {
          total: totalQr,
        },
        scans: {
          total: totalScans,
          last_30d: scansLast30d,
        },
        webhooks: {
          total: totalWebhooks,
          deliveries_last_30d: deliveriesLast30d,
        },
      };
    }
  );

}
