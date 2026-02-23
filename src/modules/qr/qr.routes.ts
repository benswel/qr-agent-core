import type { FastifyInstance } from "fastify";
import {
  qrCreateSchema,
  qrListSchema,
  qrGetSchema,
  qrUpdateSchema,
  qrDeleteSchema,
} from "./qr.schemas.js";
import * as qrService from "./qr.service.js";
import { sendError, Errors } from "../../shared/errors.js";

export async function qrRoutes(app: FastifyInstance) {
  // CREATE a new QR code
  app.post(
    "/",
    {
      schema: {
        ...qrCreateSchema,
        tags: ["QR Codes"],
        summary: "Create a new managed QR code",
        description:
          "Generates a QR code that points to a short URL managed by this service. The short URL redirects to the target_url, which can be updated later without changing the QR image. Returns the QR image data inline.",
      },
    },
    async (request, reply) => {
      const body = request.body as {
        target_url: string;
        label?: string;
        format?: "svg" | "png";
      };

      try {
        new URL(body.target_url);
      } catch {
        return sendError(reply, 400, Errors.invalidUrl(body.target_url));
      }

      const result = await qrService.createQrCode(body, request.apiKeyId);
      return reply.status(201).send(result);
    }
  );

  // LIST all QR codes
  app.get(
    "/",
    {
      schema: {
        ...qrListSchema,
        tags: ["QR Codes"],
        summary: "List all managed QR codes",
        description:
          "Returns a paginated list of all QR codes owned by the authenticated API key. Use limit and offset query parameters for pagination. Does not include image data — use GET /api/qr/:shortId for full details.",
      },
    },
    async (request) => {
      const query = request.query as { limit?: number; offset?: number };
      return qrService.listQrCodes(query.limit, query.offset, request.apiKeyId);
    }
  );

  // GET a single QR code
  app.get(
    "/:shortId",
    {
      schema: {
        ...qrGetSchema,
        tags: ["QR Codes"],
        summary: "Get a QR code by its short ID",
        description:
          "Retrieves full details of a QR code owned by the authenticated API key, including its current target URL and metadata. Does not include image_data — to regenerate the image, create a new QR code.",
      },
    },
    async (request, reply) => {
      const { shortId } = request.params as { shortId: string };
      const result = qrService.getQrCode(shortId, request.apiKeyId);

      if (!result) {
        return sendError(reply, 404, Errors.notFound("QR code", shortId));
      }

      return result;
    }
  );

  // UPDATE a QR code's target URL or label
  app.patch(
    "/:shortId",
    {
      schema: {
        ...qrUpdateSchema,
        tags: ["QR Codes"],
        summary: "Update a QR code's target URL or label",
        description:
          "Modifies the target_url or label of an existing QR code owned by the authenticated API key. This is the core 'dynamic link' feature: the QR image itself doesn't change, but the destination it redirects to does. This is ideal for printed QR codes that need to point to different content over time.",
      },
    },
    async (request, reply) => {
      const { shortId } = request.params as { shortId: string };
      const body = request.body as { target_url?: string; label?: string };

      if (body.target_url) {
        try {
          new URL(body.target_url);
        } catch {
          return sendError(reply, 400, Errors.invalidUrl(body.target_url));
        }
      }

      const result = qrService.updateQrCode(shortId, body, request.apiKeyId);

      if (!result) {
        return sendError(reply, 404, Errors.notFound("QR code", shortId));
      }

      return result;
    }
  );

  // DELETE a QR code
  app.delete(
    "/:shortId",
    {
      schema: {
        ...qrDeleteSchema,
        tags: ["QR Codes"],
        summary: "Delete a QR code and all its analytics",
        description:
          "Permanently removes a QR code owned by the authenticated API key and all associated scan events. The short URL will stop working immediately. This action cannot be undone.",
      },
    },
    async (request, reply) => {
      const { shortId } = request.params as { shortId: string };
      const deleted = qrService.deleteQrCode(shortId, request.apiKeyId);

      if (!deleted) {
        return sendError(reply, 404, Errors.notFound("QR code", shortId));
      }

      return reply.status(200).send({
        deleted: true,
        short_id: shortId,
        message: "QR code and all associated scan events have been permanently deleted.",
      });
    }
  );

  // GET QR code image (authenticated)
  app.get(
    "/:shortId/image",
    {
      schema: {
        params: {
          type: "object" as const,
          required: ["shortId"],
          properties: {
            shortId: {
              type: "string",
              description: "The short_id of the QR code.",
            },
          },
        },
        querystring: {
          type: "object" as const,
          properties: {
            format: {
              type: "string",
              enum: ["svg", "png"],
              description:
                'Override the original format. "svg" returns image/svg+xml, "png" returns image/png. If omitted, uses the format chosen at creation.',
            },
          },
        },
        tags: ["QR Codes"],
        summary: "Download the QR code image",
        description:
          "Returns the raw QR code image with the correct Content-Type header. Use this to embed the image in HTML (<img src=\"...\">) or download it. Supports format override via query parameter.",
      },
    },
    async (request, reply) => {
      const { shortId } = request.params as { shortId: string };
      const { format } = request.query as { format?: "svg" | "png" };

      const result = await qrService.getQrImage(shortId, format, request.apiKeyId);

      if (!result) {
        return sendError(reply, 404, Errors.notFound("QR code", shortId));
      }

      if (result.format === "svg") {
        return reply
          .type("image/svg+xml")
          .header("Content-Disposition", `inline; filename="${shortId}.svg"`)
          .send(result.imageData);
      }

      // PNG: imageData is a data URI, extract the base64 part
      const base64Data = result.imageData.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      return reply
        .type("image/png")
        .header("Content-Disposition", `inline; filename="${shortId}.png"`)
        .send(buffer);
    }
  );
}
