import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generateApiKey } from "./auth.service.js";
import { sendError } from "../../shared/errors.js";

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
}
