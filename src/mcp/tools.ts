import { z } from "zod";
import * as qrService from "../modules/qr/qr.service.js";

/**
 * MCP tool definitions for QR Agent Core.
 * Each tool maps to a service function and is described
 * in a way that helps LLMs understand when and how to use it.
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
      return await qrService.createQrCode(input);
    },
  },

  get_qr_code: {
    description:
      "Retrieve details of an existing QR code by its short ID. Returns the current target URL, metadata, and timestamps.",
    inputSchema: z.object({
      short_id: z.string().describe("The short ID of the QR code to look up."),
    }),
    handler: async (input: { short_id: string }) => {
      const result = qrService.getQrCode(input.short_id);
      if (!result) {
        return { error: "QR code not found", short_id: input.short_id };
      }
      return result;
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
      const result = qrService.updateQrCode(input.short_id, {
        target_url: input.target_url,
        label: input.label,
      });
      if (!result) {
        return { error: "QR code not found", short_id: input.short_id };
      }
      return result;
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
      return qrService.listQrCodes(input.limit, input.offset);
    },
  },

  delete_qr_code: {
    description:
      "Permanently delete a QR code and all its scan analytics. The short URL will stop working immediately. This cannot be undone.",
    inputSchema: z.object({
      short_id: z.string().describe("The short ID of the QR code to delete."),
    }),
    handler: async (input: { short_id: string }) => {
      const deleted = qrService.deleteQrCode(input.short_id);
      if (!deleted) {
        return { error: "QR code not found", short_id: input.short_id };
      }
      return { deleted: true, short_id: input.short_id };
    },
  },
};
