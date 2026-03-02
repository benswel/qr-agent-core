import { z } from "zod";
import { apiRequest } from "./api-client.js";

/**
 * MCP tool definitions for QR Agent Core.
 * Each tool calls the production HTTP API.
 */
export const tools = {
  create_qr_code: {
    description:
      "Create a new managed QR code with optional custom styling. The QR code points to a short URL that redirects to your target URL. You can change the target URL later without regenerating the QR image. Supports custom colors, dot shapes, corner shapes, and logo embedding.",
    inputSchema: z.object({
      target_url: z
        .string()
        .url()
        .describe("The destination URL the QR code should redirect to."),
      label: z
        .string()
        .optional()
        .describe("An optional label to identify this QR code."),
      format: z
        .enum(["svg", "png"])
        .default("svg")
        .describe(
          'Image format. "svg" is recommended (smaller, scalable, text-parseable). Use "png" only if a bitmap is required.'
        ),
      foreground_color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional()
        .describe("Hex color for QR code dots. Default: #000000 (black)."),
      background_color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional()
        .describe("Hex color for QR code background. Default: #ffffff (white)."),
      width: z
        .number()
        .min(200)
        .max(2000)
        .optional()
        .describe("QR code width in pixels. Default: 400."),
      margin: z
        .number()
        .min(0)
        .max(10)
        .optional()
        .describe("Quiet zone margin in modules. Default: 2."),
      error_correction: z
        .enum(["L", "M", "Q", "H"])
        .optional()
        .describe("Error correction level. L=7%, M=15% (default), Q=25%, H=30%. Auto-set to H when logo is provided."),
      dot_style: z
        .enum(["square", "rounded", "dots", "classy-rounded"])
        .optional()
        .describe("Shape of data modules. square=classic, rounded=soft corners, dots=circles, classy-rounded=organic."),
      corner_style: z
        .enum(["square", "extra-rounded", "dot"])
        .optional()
        .describe("Shape of finder patterns (corner squares). square=classic, extra-rounded=smooth, dot=circular."),
      logo_url: z
        .string()
        .optional()
        .describe("URL to a logo image (PNG/JPG/SVG) or data:base64 URI. Centered on the QR code."),
      logo_size: z
        .number()
        .min(0.15)
        .max(0.3)
        .optional()
        .describe("Logo size as ratio of QR width (0.15-0.3). Default: 0.2."),
      expires_at: z
        .string()
        .optional()
        .describe("ISO 8601 date-time. After this date, scanning returns 410 Gone instead of redirecting."),
      scheduled_url: z
        .string()
        .url()
        .optional()
        .describe("Replacement URL that activates at scheduled_at."),
      scheduled_at: z
        .string()
        .optional()
        .describe("ISO 8601 date-time when target automatically switches to scheduled_url."),
    }),
    handler: async (input: Record<string, unknown>) => {
      return apiRequest("/api/qr", { method: "POST", body: input });
    },
  },

  get_qr_code: {
    description:
      "Retrieve details of an existing QR code by its short ID. Returns the current target URL, metadata, and timestamps.",
    inputSchema: z.object({
      short_id: z.string().describe("The short ID of the QR code to look up."),
    }),
    handler: async (input: { short_id: string }) => {
      return apiRequest(`/api/qr/${input.short_id}`);
    },
  },

  update_qr_destination: {
    description:
      "Change where an existing QR code redirects to. This is the key 'dynamic link' feature: the QR image stays the same, but scanning it will now go to the new URL. Ideal for updating campaigns, fixing broken links, or A/B testing.",
    inputSchema: z.object({
      short_id: z.string().describe("The short ID of the QR code to update."),
      target_url: z
        .string()
        .url()
        .describe("The new destination URL."),
      label: z
        .string()
        .optional()
        .describe("Optionally update the label too."),
      expires_at: z
        .string()
        .nullable()
        .optional()
        .describe("ISO 8601 expiration date. Set to null to remove expiration."),
      scheduled_url: z
        .string()
        .url()
        .nullable()
        .optional()
        .describe("Scheduled replacement URL. Set to null to cancel."),
      scheduled_at: z
        .string()
        .nullable()
        .optional()
        .describe("ISO 8601 activation date for scheduled_url. Set to null to cancel."),
    }),
    handler: async (input: { short_id: string; target_url: string; label?: string; expires_at?: string | null; scheduled_url?: string | null; scheduled_at?: string | null }) => {
      const body: Record<string, unknown> = { target_url: input.target_url, label: input.label };
      if (input.expires_at !== undefined) body.expires_at = input.expires_at;
      if (input.scheduled_url !== undefined) body.scheduled_url = input.scheduled_url;
      if (input.scheduled_at !== undefined) body.scheduled_at = input.scheduled_at;
      return apiRequest(`/api/qr/${input.short_id}`, {
        method: "PATCH",
        body,
      });
    },
  },

  list_qr_codes: {
    description:
      "List all managed QR codes with pagination. Returns short IDs, target URLs, labels, and timestamps. Use this to browse or search for existing QR codes.",
    inputSchema: z.object({
      limit: z.number().min(1).max(100).default(20).describe("Max results to return."),
      offset: z.number().min(0).default(0).describe("Number of results to skip."),
    }),
    handler: async (input: { limit: number; offset: number }) => {
      return apiRequest("/api/qr", { query: { limit: input.limit, offset: input.offset } });
    },
  },

  delete_qr_code: {
    description:
      "Permanently delete a QR code and all its scan analytics. The short URL will stop working immediately. This cannot be undone.",
    inputSchema: z.object({
      short_id: z.string().describe("The short ID of the QR code to delete."),
    }),
    handler: async (input: { short_id: string }) => {
      return apiRequest(`/api/qr/${input.short_id}`, { method: "DELETE" });
    },
  },

  get_qr_analytics: {
    description:
      "Get enriched scan analytics for a QR code. Returns total scans, daily trends, device/browser/country/referer breakdowns with percentages, and recent scan events with parsed user-agent and geo data.",
    inputSchema: z.object({
      short_id: z.string().describe("The short ID of the QR code to get analytics for."),
      period: z
        .enum(["7d", "30d", "90d", "all"])
        .default("30d")
        .describe("Time period for aggregations. Default: 30d."),
    }),
    handler: async (input: { short_id: string; period: string }) => {
      return apiRequest(`/api/analytics/${input.short_id}`, { query: { period: input.period } });
    },
  },

  bulk_create_qr_codes: {
    description:
      "Create multiple QR codes in a single request (up to 50). Each item supports the same options as create_qr_code. The quota check is all-or-nothing: if the batch would exceed your plan limit, no QR codes are created. Ideal for generating QR codes for product catalogs, event lists, or batch operations.",
    inputSchema: z.object({
      items: z
        .array(
          z.object({
            target_url: z.string().url().describe("The destination URL."),
            label: z.string().optional().describe("Optional label."),
            format: z.enum(["svg", "png"]).default("svg").describe("Image format."),
            foreground_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for dots."),
            background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for background."),
            dot_style: z.enum(["square", "rounded", "dots", "classy-rounded"]).optional().describe("Dot shape."),
            corner_style: z.enum(["square", "extra-rounded", "dot"]).optional().describe("Corner shape."),
            logo_url: z.string().optional().describe("Logo URL or data URI."),
            expires_at: z.string().optional().describe("ISO 8601 expiration date."),
            scheduled_url: z.string().url().optional().describe("Replacement URL activated at scheduled_at."),
            scheduled_at: z.string().optional().describe("ISO 8601 activation date for scheduled_url."),
          })
        )
        .min(1)
        .max(50)
        .describe("Array of QR codes to create. Max 50 per request."),
    }),
    handler: async (input: Record<string, unknown>) => {
      return apiRequest("/api/qr/bulk", { method: "POST", body: input });
    },
  },

  bulk_update_qr_codes: {
    description:
      "Update multiple QR codes in a single request (up to 50). Change target URLs and/or labels. Items with non-existent short_id are reported as not_found without failing the whole batch.",
    inputSchema: z.object({
      items: z
        .array(
          z.object({
            short_id: z.string().describe("The short_id of the QR code to update."),
            target_url: z.string().url().optional().describe("New destination URL."),
            label: z.string().optional().describe("New label."),
            expires_at: z.string().nullable().optional().describe("ISO 8601 expiration date. Null to clear."),
            scheduled_url: z.string().url().nullable().optional().describe("Replacement URL. Null to cancel."),
            scheduled_at: z.string().nullable().optional().describe("ISO 8601 activation date. Null to cancel."),
          })
        )
        .min(1)
        .max(50)
        .describe("Array of QR code updates. Max 50 per request."),
    }),
    handler: async (input: Record<string, unknown>) => {
      return apiRequest("/api/qr/bulk", { method: "PATCH", body: input });
    },
  },

  bulk_delete_qr_codes: {
    description:
      "Delete multiple QR codes and their scan analytics in a single request (up to 50). Items with non-existent short_id are reported as not_found without failing the whole batch.",
    inputSchema: z.object({
      short_ids: z
        .array(z.string())
        .min(1)
        .max(50)
        .describe("Array of short_id strings to delete. Max 50 per request."),
    }),
    handler: async (input: Record<string, unknown>) => {
      return apiRequest("/api/qr/bulk", { method: "DELETE", body: input });
    },
  },

  create_webhook: {
    description:
      "Register a webhook endpoint to receive real-time notifications when QR codes are scanned. Returns an HMAC-SHA256 secret for verifying webhook signatures — store it securely, it is only shown once.",
    inputSchema: z.object({
      url: z
        .string()
        .url()
        .describe("The endpoint URL that will receive POST requests with scan event data."),
      events: z
        .array(z.enum(["qr.scanned"]))
        .default(["qr.scanned"])
        .describe('Events to subscribe to. Currently supported: "qr.scanned".'),
    }),
    handler: async (input: { url: string; events?: string[] }) => {
      return apiRequest("/api/webhooks", { method: "POST", body: input });
    },
  },

  list_webhooks: {
    description:
      "List all registered webhook endpoints for your API key. The HMAC secret is not included for security.",
    inputSchema: z.object({}),
    handler: async () => {
      return apiRequest("/api/webhooks");
    },
  },

  delete_webhook: {
    description:
      "Delete a webhook endpoint and all its delivery logs. The endpoint will stop receiving events immediately.",
    inputSchema: z.object({
      webhook_id: z
        .number()
        .describe("The ID of the webhook to delete. Use list_webhooks to find IDs."),
    }),
    handler: async (input: { webhook_id: number }) => {
      return apiRequest(`/api/webhooks/${input.webhook_id}`, { method: "DELETE" });
    },
  },

  register: {
    description:
      "Register for an API key. Provide your email to get a key immediately.",
    inputSchema: z.object({
      email: z.string().email().describe("Your email address."),
      label: z
        .string()
        .optional()
        .describe("An optional label to identify this API key."),
    }),
    handler: async (input: { email: string; label?: string }) => {
      return apiRequest("/api/register", { method: "POST", body: input });
    },
  },

  get_usage: {
    description:
      "Get current usage and quota for your API key.",
    inputSchema: z.object({}),
    handler: async () => {
      return apiRequest("/api/usage");
    },
  },

  upgrade_to_pro: {
    description:
      "Upgrade to the Pro plan ($19/month) for unlimited QR codes, scans, and webhooks. Returns a Stripe Checkout URL — tell the user to open it in their browser to complete payment. The upgrade takes effect automatically after payment.",
    inputSchema: z.object({}),
    handler: async () => {
      return apiRequest("/api/stripe/checkout", { method: "POST" });
    },
  },

  manage_billing: {
    description:
      "Open the Stripe billing portal to manage your subscription, update payment method, or cancel. Returns a portal URL — tell the user to open it in their browser. Only works if you have an active Pro subscription.",
    inputSchema: z.object({}),
    handler: async () => {
      return apiRequest("/api/stripe/portal", { method: "POST" });
    },
  },
};
