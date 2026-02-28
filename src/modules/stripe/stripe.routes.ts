import type { FastifyInstance } from "fastify";
import * as stripeService from "./stripe.service.js";
import { sendError } from "../../shared/errors.js";

export async function stripeRoutes(app: FastifyInstance) {
  // Scoped raw body parser for webhook signature verification
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      (req as any).rawBody = body;
      const str = body.toString();
      if (!str) {
        done(null, null);
        return;
      }
      try {
        done(null, JSON.parse(str));
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  // POST /api/stripe/checkout — create Stripe Checkout session
  app.post(
    "/checkout",
    {
      schema: {
        tags: ["Billing"],
        summary: "Create a Stripe Checkout session to upgrade to Pro",
        description:
          "Creates a Stripe Checkout session for the Pro plan ($19/month). Returns a URL to complete payment in a browser. The plan upgrade happens automatically via webhook after successful payment.",
        response: {
          200: {
            type: "object",
            properties: {
              checkout_url: {
                type: "string",
                description: "Stripe Checkout URL. Open this in a browser to complete payment.",
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await stripeService.createCheckoutSession(request.apiKeyId);

      if ("error" in result) {
        if (result.error === "EMAIL_REQUIRED") {
          return sendError(reply, 400, {
            error: "No email associated with this API key.",
            code: "EMAIL_REQUIRED",
            hint: "Register a new API key with an email address via POST /api/register, then use that key to upgrade.",
          });
        }
        if (result.error === "ALREADY_PRO") {
          return sendError(reply, 400, {
            error: "This API key is already on the Pro plan.",
            code: "ALREADY_PRO",
            hint: "Use the manage_billing tool to access the Stripe Customer Portal for managing your subscription.",
          });
        }
        if (result.error === "STRIPE_NOT_CONFIGURED") {
          return sendError(reply, 503, {
            error: "Stripe is not configured on this server.",
            code: "STRIPE_NOT_CONFIGURED",
            hint: "If self-hosting, set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PRICE_ID environment variables.",
          });
        }
      }

      return reply.send(result);
    }
  );

  // POST /api/stripe/portal — create Stripe Customer Portal session
  app.post(
    "/portal",
    {
      schema: {
        tags: ["Billing"],
        summary: "Open the Stripe billing portal",
        description:
          "Creates a Stripe Customer Portal session for managing billing, payment method, and subscription cancellation. Returns a URL to open in a browser.",
        response: {
          200: {
            type: "object",
            properties: {
              portal_url: {
                type: "string",
                description: "Stripe Customer Portal URL for managing billing.",
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await stripeService.createPortalSession(request.apiKeyId);

      if ("error" in result) {
        if (result.error === "NO_SUBSCRIPTION") {
          return sendError(reply, 400, {
            error: "No active subscription found for this API key.",
            code: "NO_SUBSCRIPTION",
            hint: "Use the upgrade_to_pro tool to subscribe to the Pro plan first.",
          });
        }
        if (result.error === "STRIPE_NOT_CONFIGURED") {
          return sendError(reply, 503, {
            error: "Stripe is not configured on this server.",
            code: "STRIPE_NOT_CONFIGURED",
            hint: "If self-hosting, set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PRICE_ID environment variables.",
          });
        }
      }

      return reply.send(result);
    }
  );

  // POST /api/stripe/webhook — Stripe webhook handler (public, raw body)
  app.post(
    "/webhook",
    {
      schema: {
        tags: ["Billing"],
        summary: "Stripe webhook endpoint",
        hide: true,
      },
    },
    async (request, reply) => {
      const signature = request.headers["stripe-signature"] as string;
      if (!signature) {
        return sendError(reply, 400, {
          error: "Missing Stripe signature.",
          code: "MISSING_SIGNATURE",
          hint: "This endpoint is for Stripe webhooks only. Do not call it directly.",
        });
      }

      try {
        const result = await stripeService.handleWebhookEvent(
          request.rawBody as Buffer,
          signature
        );
        return reply.send(result);
      } catch {
        return sendError(reply, 400, {
          error: "Webhook signature verification failed.",
          code: "WEBHOOK_VERIFICATION_FAILED",
          hint: "Ensure the STRIPE_WEBHOOK_SECRET matches the webhook endpoint configured in Stripe Dashboard.",
        });
      }
    }
  );
}
