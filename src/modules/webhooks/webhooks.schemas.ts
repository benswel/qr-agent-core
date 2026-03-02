export const webhookCreateSchema = {
  body: {
    type: "object" as const,
    required: ["url"],
    properties: {
      url: {
        type: "string",
        description:
          "The HTTP/HTTPS endpoint that will receive webhook events via POST. Must be publicly accessible. The payload is JSON with an HMAC-SHA256 signature in the X-Webhook-Signature header.",
      },
      events: {
        type: "array",
        items: { type: "string", enum: ["qr.scanned", "qr.conversion"] },
        default: ["qr.scanned"],
        description:
          'Events to subscribe to. Supported: "qr.scanned" (triggered on scan/redirect), "qr.conversion" (triggered when a conversion is recorded).',
      },
    },
  },
  response: {
    201: {
      type: "object",
      description:
        "The newly created webhook with its HMAC secret. The secret is only returned at creation time — store it securely.",
      properties: {
        id: { type: "integer", description: "Webhook identifier." },
        url: { type: "string", description: "The endpoint URL." },
        secret: {
          type: "string",
          description:
            "HMAC-SHA256 secret for verifying webhook signatures. Only returned at creation — store it securely. To verify: compute HMAC-SHA256 of the raw request body using this secret, compare with the X-Webhook-Signature header.",
        },
        events: {
          type: "array",
          items: { type: "string" },
          description: "Subscribed events.",
        },
        is_active: { type: "boolean", description: "Whether the webhook is active." },
        created_at: { type: "string", description: "ISO 8601 creation timestamp." },
      },
    },
  },
};

export const webhookListSchema = {
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "integer" },
              url: { type: "string" },
              events: { type: "array", items: { type: "string" } },
              is_active: { type: "boolean" },
              created_at: { type: "string" },
            },
          },
        },
        total: { type: "integer" },
      },
    },
  },
};

export const webhookDeleteSchema = {
  params: {
    type: "object" as const,
    required: ["id"],
    properties: {
      id: {
        type: "integer",
        description: "The ID of the webhook to delete.",
      },
    },
  },
};
