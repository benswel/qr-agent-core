/**
 * JSON Schemas for the QR module.
 * Every field has a `description` — this is intentional.
 * LLMs and agents parse OpenAPI specs to understand APIs;
 * rich descriptions act as inline documentation for machines.
 */

export const qrCreateSchema = {
  body: {
    type: "object" as const,
    required: ["target_url"],
    properties: {
      target_url: {
        type: "string",
        description:
          "The destination URL that this QR code will redirect to. Must be a fully-qualified absolute URL (e.g., https://example.com). This URL can be changed later via PATCH without regenerating the QR code image.",
      },
      label: {
        type: "string",
        description:
          "An optional human/agent-readable label for this QR code. Useful for organizing and searching through multiple QR codes programmatically.",
      },
      format: {
        type: "string",
        enum: ["svg", "png"],
        default: "svg",
        description:
          'The image format for the generated QR code. "svg" (default, recommended) produces a lightweight vector image that can be embedded directly in HTML/XML, scales to any size without quality loss, and is text-parseable. "png" produces a raster bitmap — use only when a pixel-based format is strictly required.',
      },
    },
  },
  response: {
    201: {
      type: "object",
      description: "The newly created QR code resource with its short URL and image data.",
      properties: {
        id: { type: "integer", description: "Internal numeric identifier." },
        short_id: {
          type: "string",
          description:
            "The unique short identifier used in the redirect URL. This is the value encoded in the QR image.",
        },
        short_url: {
          type: "string",
          description:
            "The full short URL that the QR code points to. Scanning the QR code navigates to this URL, which then redirects to target_url.",
        },
        target_url: { type: "string", description: "The current destination URL." },
        label: { type: "string", nullable: true, description: "Optional label." },
        format: { type: "string", description: "Image format (svg or png)." },
        image_data: {
          type: "string",
          description:
            'The QR code image. For SVG format: raw SVG XML string. For PNG format: base64-encoded binary data (prefix with "data:image/png;base64," to use as a data URI).',
        },
        created_at: { type: "string", description: "ISO 8601 creation timestamp." },
      },
    },
  },
};

export const qrListSchema = {
  querystring: {
    type: "object" as const,
    properties: {
      limit: {
        type: "integer",
        default: 20,
        minimum: 1,
        maximum: 100,
        description: "Maximum number of QR codes to return. Defaults to 20, max 100.",
      },
      offset: {
        type: "integer",
        default: 0,
        minimum: 0,
        description: "Number of records to skip for pagination.",
      },
    },
  },
};

export const qrUpdateSchema = {
  params: {
    type: "object" as const,
    required: ["shortId"],
    properties: {
      shortId: {
        type: "string",
        description: "The short_id of the QR code to update.",
      },
    },
  },
  body: {
    type: "object" as const,
    properties: {
      target_url: {
        type: "string",
        description:
          "New destination URL. Updating this does NOT change the QR code image — the same QR image will now redirect to this new URL. This is the core 'dynamic link' feature.",
      },
      label: {
        type: "string",
        description: "Updated label for the QR code.",
      },
    },
  },
};

export const qrGetSchema = {
  params: {
    type: "object" as const,
    required: ["shortId"],
    properties: {
      shortId: {
        type: "string",
        description: "The short_id of the QR code to retrieve.",
      },
    },
  },
};

export const qrDeleteSchema = {
  params: {
    type: "object" as const,
    required: ["shortId"],
    properties: {
      shortId: {
        type: "string",
        description:
          "The short_id of the QR code to delete. This will also delete all associated scan analytics. This action is irreversible.",
      },
    },
  },
};
