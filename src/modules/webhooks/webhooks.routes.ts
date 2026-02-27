import type { FastifyInstance } from "fastify";
import {
  webhookCreateSchema,
  webhookListSchema,
  webhookDeleteSchema,
} from "./webhooks.schemas.js";
import * as webhooksService from "./webhooks.service.js";
import { sendError, Errors } from "../../shared/errors.js";

export async function webhooksRoutes(app: FastifyInstance) {
  // CREATE a webhook
  app.post(
    "/",
    {
      schema: {
        ...webhookCreateSchema,
        tags: ["Webhooks"],
        summary: "Register a webhook endpoint",
        description:
          "Register a URL to receive real-time POST notifications when subscribed events occur. Returns an HMAC-SHA256 secret for verifying webhook signatures. The secret is only shown once at creation — store it securely.",
      },
    },
    async (request, reply) => {
      const body = request.body as { url: string; events?: string[] };

      try {
        const parsed = new URL(body.url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          return sendError(reply, 400, Errors.invalidWebhookUrl(body.url));
        }
      } catch {
        return sendError(reply, 400, Errors.invalidWebhookUrl(body.url));
      }

      const events = body.events || ["qr.scanned"];
      const result = webhooksService.createWebhook(body.url, events, request.apiKeyId, request.plan);

      if ("error" in result && result.error === "WEBHOOK_LIMIT_REACHED") {
        return sendError(reply, 403, Errors.webhookLimitReached(result.limit));
      }

      return reply.status(201).send(result);
    }
  );

  // LIST webhooks
  app.get(
    "/",
    {
      schema: {
        ...webhookListSchema,
        tags: ["Webhooks"],
        summary: "List all registered webhooks",
        description:
          "Returns all webhook endpoints registered by the authenticated API key. The HMAC secret is not included in list responses for security.",
      },
    },
    async (request) => {
      return webhooksService.listWebhooks(request.apiKeyId);
    }
  );

  // DELETE a webhook
  app.delete(
    "/:id",
    {
      schema: {
        ...webhookDeleteSchema,
        tags: ["Webhooks"],
        summary: "Delete a webhook endpoint",
        description:
          "Permanently removes a webhook and all its delivery logs. The endpoint will stop receiving events immediately.",
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: number };
      const deleted = webhooksService.deleteWebhook(id, request.apiKeyId);

      if (!deleted) {
        return sendError(reply, 404, Errors.webhookNotFound(id));
      }

      return reply.status(200).send({
        deleted: true,
        id,
        message: "Webhook and all delivery logs have been permanently deleted.",
      });
    }
  );
}
