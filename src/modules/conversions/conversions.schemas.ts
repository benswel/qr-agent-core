export const conversionRecordSchema = {
  body: {
    type: "object" as const,
    required: ["short_id", "event"],
    properties: {
      short_id: {
        type: "string",
        description: "The short_id of the QR code this conversion is for.",
      },
      event: {
        type: "string",
        maxLength: 100,
        description:
          'The conversion event name (e.g., "purchase", "signup", "add_to_cart"). Use consistent names to aggregate stats.',
      },
      value: {
        type: "number",
        description: "Optional monetary value of the conversion (e.g., 49.99).",
      },
      metadata: {
        type: "object",
        additionalProperties: true,
        description:
          "Optional JSON metadata for the conversion (e.g., product ID, order number).",
      },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Conversion event ID." },
        short_id: { type: "string" },
        event: { type: "string" },
        value: { type: "number", nullable: true },
        metadata: { type: "object", nullable: true, additionalProperties: true },
        created_at: { type: "string" },
      },
    },
  },
};

export const conversionStatsSchema = {
  params: {
    type: "object" as const,
    required: ["shortId"],
    properties: {
      shortId: {
        type: "string",
        description: "The short_id of the QR code to get conversion stats for.",
      },
    },
  },
  querystring: {
    type: "object" as const,
    properties: {
      period: {
        type: "string",
        enum: ["7d", "30d", "90d", "all"],
        default: "30d",
        description: "Time period for aggregations. Default: 30d.",
      },
      event: {
        type: "string",
        description: "Filter by event name (e.g., 'purchase').",
      },
    },
  },
};

export const conversionPixelSchema = {
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
      event: {
        type: "string",
        description: "The conversion event name (required).",
      },
      value: {
        type: "number",
        description: "Optional monetary value.",
      },
      meta: {
        type: "string",
        description: "Optional JSON-encoded metadata.",
      },
    },
  },
};
