import { z } from "zod";
import { apiRequest } from "./api-client.js";

/**
 * MCP tool definitions for QR Agent Core.
 * Each tool calls the production HTTP API.
 */
export const tools = {
  create_qr_code: {
    description:
      "Create a new managed QR code. The QR code points to a short URL that redirects to your target URL. You can change the target URL later without regenerating the QR image. Returns the QR image data (SVG or PNG) and the short URL.",
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
    }),
    handler: async (input: { target_url: string; label?: string; format?: "svg" | "png" }) => {
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
};
