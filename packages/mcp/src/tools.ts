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
    }),
    handler: async (input: { short_id: string; target_url: string; label?: string }) => {
      return apiRequest(`/api/qr/${input.short_id}`, {
        method: "PATCH",
        body: { target_url: input.target_url, label: input.label },
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
      "Get scan analytics for a QR code. Returns total scan count and recent scan events with timestamps and user agents.",
    inputSchema: z.object({
      short_id: z.string().describe("The short ID of the QR code to get analytics for."),
    }),
    handler: async (input: { short_id: string }) => {
      return apiRequest(`/api/analytics/${input.short_id}`);
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

  join_waitlist: {
    description:
      "Join the Pro plan waitlist to be notified when it launches.",
    inputSchema: z.object({
      email: z.string().email().describe("Your email address."),
    }),
    handler: async (input: { email: string }) => {
      return apiRequest("/api/waitlist", { method: "POST", body: input });
    },
  },
};
