import type { FastifyInstance } from "fastify";
import { sendError } from "../../shared/errors.js";
import { getCustomDomain, setCustomDomain, isCustomDomainTaken } from "../auth/auth.service.js";
import { checkDnsStatus } from "./domain.dns.js";

export async function domainRoutes(app: FastifyInstance) {
  // GET /api/domain — get current custom domain + DNS status
  app.get(
    "/",
    {
      schema: {
        tags: ["Custom Domain"],
        summary: "Get your custom domain configuration",
        description:
          "Returns the custom domain set on your API key, if any, along with its DNS verification status.",
        response: {
          200: {
            type: "object",
            properties: {
              custom_domain: { type: ["string", "null"] },
              dns_status: { type: ["string", "null"] },
              hint: { type: "string" },
            },
          },
        },
      },
    },
    async (request) => {
      const domain = getCustomDomain(request.apiKeyId);

      if (!domain) {
        return {
          custom_domain: null,
          dns_status: null,
          hint: "No custom domain configured. Use PUT /api/domain to set one (Pro plan required).",
        };
      }

      const dnsStatus = await checkDnsStatus(domain);

      return {
        custom_domain: domain,
        dns_status: dnsStatus,
        hint:
          dnsStatus === "active"
            ? `Domain ${domain} is active. Your QR short URLs will use https://${domain}/r/...`
            : `Domain ${domain} is pending DNS verification. Add a CNAME record pointing to your server, then check again.`,
      };
    }
  );

  // PUT /api/domain — set custom domain (Pro only)
  app.put(
    "/",
    {
      schema: {
        tags: ["Custom Domain"],
        summary: "Set your custom domain",
        description:
          "Configure a custom domain for your QR code short URLs. Pro plan required. The domain must be unique across all users.",
        body: {
          type: "object",
          required: ["domain"],
          properties: {
            domain: {
              type: "string",
              description:
                "Your custom domain without protocol (e.g. 'qr.mybrand.com').",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              custom_domain: { type: "string" },
              dns_status: { type: "string" },
              hint: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Pro-only gate
      if (request.plan !== "pro") {
        return sendError(reply, 403, {
          error: "Custom domains require a Pro plan.",
          code: "PRO_REQUIRED",
          hint: "Upgrade to Pro ($19/month) to use custom domains. Use the upgrade_to_pro tool or POST /api/stripe/checkout.",
        });
      }

      const { domain } = request.body as { domain: string };

      // Basic validation: no protocol, no path, no whitespace
      const cleaned = domain.trim().toLowerCase();
      if (
        !cleaned ||
        cleaned.includes("://") ||
        cleaned.includes("/") ||
        cleaned.includes(" ")
      ) {
        return sendError(reply, 400, {
          error: "Invalid domain format.",
          code: "INVALID_DOMAIN",
          hint: "Provide a bare domain without protocol or path (e.g. 'qr.mybrand.com', not 'https://qr.mybrand.com/').",
        });
      }

      // Must contain at least one dot
      if (!cleaned.includes(".")) {
        return sendError(reply, 400, {
          error: "Invalid domain format.",
          code: "INVALID_DOMAIN",
          hint: "Provide a fully qualified domain name with at least one dot (e.g. 'qr.mybrand.com').",
        });
      }

      // Uniqueness check
      if (isCustomDomainTaken(cleaned, request.apiKeyId)) {
        return sendError(reply, 409, {
          error: `Domain "${cleaned}" is already claimed by another user.`,
          code: "DOMAIN_ALREADY_TAKEN",
          hint: "Choose a different subdomain or contact support if you believe this is an error.",
        });
      }

      setCustomDomain(request.apiKeyId, cleaned);
      const dnsStatus = await checkDnsStatus(cleaned);

      return {
        custom_domain: cleaned,
        dns_status: dnsStatus,
        hint:
          dnsStatus === "active"
            ? `Domain ${cleaned} is active. New QR codes will use https://${cleaned}/r/...`
            : `Domain ${cleaned} saved. DNS is pending — add a CNAME record pointing to your server. Use GET /api/domain to re-check status.`,
      };
    }
  );

  // DELETE /api/domain — remove custom domain
  app.delete(
    "/",
    {
      schema: {
        tags: ["Custom Domain"],
        summary: "Remove your custom domain",
        description:
          "Removes the custom domain from your API key. QR codes will revert to using the default domain for new short URLs.",
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const existing = getCustomDomain(request.apiKeyId);

      if (!existing) {
        return sendError(reply, 404, {
          error: "No custom domain is configured.",
          code: "NO_CUSTOM_DOMAIN",
          hint: "There is no custom domain to remove. Use PUT /api/domain to set one.",
        });
      }

      setCustomDomain(request.apiKeyId, null);

      return {
        message: `Custom domain "${existing}" has been removed. New QR codes will use the default domain.`,
      };
    }
  );
}
