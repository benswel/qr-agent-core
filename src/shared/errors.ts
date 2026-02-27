import type { FastifyReply } from "fastify";

interface AgentError {
  error: string;
  code: string;
  hint: string;
  docs?: string;
}

/**
 * Every error response is structured for machine consumption.
 * - `error`: Human-readable message
 * - `code`: Machine-parseable error identifier (UPPER_SNAKE_CASE)
 * - `hint`: Actionable instruction an AI agent can follow to fix the request
 * - `docs`: Optional link to relevant API documentation
 */
export function sendError(
  reply: FastifyReply,
  statusCode: number,
  error: AgentError
) {
  return reply.status(statusCode).send(error);
}

export const Errors = {
  notFound: (resource: string, id: string): AgentError => ({
    error: `${resource} with identifier "${id}" was not found.`,
    code: "RESOURCE_NOT_FOUND",
    hint: `Verify the identifier "${id}" is correct. Use GET /api/qr to list all available QR codes.`,
  }),

  invalidUrl: (url: string): AgentError => ({
    error: `The provided URL "${url}" is not a valid absolute URL.`,
    code: "INVALID_URL",
    hint: "Provide a fully-qualified URL including the protocol (e.g., https://example.com). Relative paths are not accepted.",
  }),

  invalidFormat: (format: string): AgentError => ({
    error: `Format "${format}" is not supported.`,
    code: "INVALID_FORMAT",
    hint: 'Supported formats are "svg" (recommended for agents — smaller, scalable, embeddable as text) and "png" (raster, useful when a bitmap is required).',
  }),

  validationFailed: (details: string): AgentError => ({
    error: `Request validation failed: ${details}`,
    code: "VALIDATION_ERROR",
    hint: "Check the request body against the JSON Schema available at GET /documentation/json. Each field has a description explaining its purpose and constraints.",
  }),

  webhookNotFound: (webhookId: number): AgentError => ({
    error: `Webhook with ID ${webhookId} was not found or you don't have permission to access it.`,
    code: "WEBHOOK_NOT_FOUND",
    hint: "Verify the webhook ID is correct and belongs to your API key. Use GET /api/webhooks to list your webhooks.",
  }),

  invalidWebhookUrl: (url: string): AgentError => ({
    error: `The webhook URL "${url}" is not valid.`,
    code: "INVALID_WEBHOOK_URL",
    hint: "Provide a valid HTTP or HTTPS URL for the webhook endpoint. The URL must be publicly accessible to receive events.",
  }),
} as const;
