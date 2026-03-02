/**
 * JSON Schemas for the QR module.
 * Every field has a `description` — this is intentional.
 * LLMs and agents parse OpenAPI specs to understand APIs;
 * rich descriptions act as inline documentation for machines.
 */

export const qrCreateSchema = {
  body: {
    type: "object" as const,
    properties: {
      type: {
        type: "string",
        enum: ["url", "vcard", "wifi"],
        default: "url",
        description:
          "QR code type. 'url' (default): encodes a redirect short URL — destination can be changed without regenerating the QR image. 'vcard': encodes contact data directly — phones prompt to save the contact. 'wifi': encodes WiFi credentials directly — phones prompt to join the network.",
      },
      target_url: {
        type: "string",
        description:
          "The destination URL that this QR code will redirect to. Required for type='url'. Must be a fully-qualified absolute URL (e.g., https://example.com). This URL can be changed later via PATCH without regenerating the QR code image.",
      },
      vcard_data: {
        type: "object",
        description:
          "Contact data for vCard QR codes. Required when type='vcard'. At minimum, first_name and last_name must be provided.",
        properties: {
          first_name: { type: "string", description: "Contact first name." },
          last_name: { type: "string", description: "Contact last name." },
          organization: { type: "string", description: "Company or organization name." },
          title: { type: "string", description: "Job title." },
          email: { type: "string", description: "Email address." },
          phone: { type: "string", description: "Phone number." },
          url: { type: "string", description: "Website URL." },
          address: { type: "string", description: "Street address (free-form)." },
          note: { type: "string", description: "Additional notes." },
        },
      },
      wifi_data: {
        type: "object",
        description:
          "WiFi credentials for WiFi QR codes. Required when type='wifi'. ssid is required.",
        properties: {
          ssid: { type: "string", description: "WiFi network name (SSID)." },
          password: { type: "string", description: "WiFi password. Omit for open networks (encryption='nopass')." },
          encryption: { type: "string", enum: ["WPA", "WEP", "nopass"], default: "WPA", description: "Encryption type." },
          hidden: { type: "boolean", default: false, description: "Whether the network is hidden." },
        },
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
      foreground_color: {
        type: "string",
        pattern: "^#[0-9A-Fa-f]{6}$",
        default: "#000000",
        description: "Hex color for QR code data modules (dots). Default: #000000 (black).",
      },
      background_color: {
        type: "string",
        pattern: "^#[0-9A-Fa-f]{6}$",
        default: "#ffffff",
        description: "Hex color for QR code background. Default: #ffffff (white). Use #00000000 for transparent (SVG only).",
      },
      width: {
        type: "integer",
        minimum: 200,
        maximum: 2000,
        default: 400,
        description: "QR code width in pixels. Default: 400. Higher values produce sharper images.",
      },
      margin: {
        type: "integer",
        minimum: 0,
        maximum: 10,
        default: 2,
        description: "Quiet zone margin in QR modules. Default: 2. Set to 0 for no margin.",
      },
      error_correction: {
        type: "string",
        enum: ["L", "M", "Q", "H"],
        default: "M",
        description: "Error correction level. L=7%, M=15% (default), Q=25%, H=30%. Automatically set to H when a logo is provided.",
      },
      dot_style: {
        type: "string",
        enum: ["square", "rounded", "dots", "classy-rounded"],
        default: "square",
        description: "Shape of data modules. square=classic sharp corners, rounded=softened corners, dots=circles, classy-rounded=organic rounded shape.",
      },
      corner_style: {
        type: "string",
        enum: ["square", "extra-rounded", "dot"],
        default: "square",
        description: "Shape of the 3 finder patterns (large corner squares). square=classic, extra-rounded=smooth corners, dot=circular.",
      },
      logo_url: {
        type: "string",
        description: "URL to a logo image (PNG/JPG/SVG) or a data:base64 URI. The logo is centered on the QR code. Error correction is auto-set to H for maximum resilience.",
      },
      logo_size: {
        type: "number",
        minimum: 0.15,
        maximum: 0.3,
        default: 0.2,
        description: "Logo size as a ratio of QR code width (0.15 to 0.3). Default: 0.2 (20% of width).",
      },
      expires_at: {
        type: "string",
        description:
          "ISO 8601 date-time. After this date, scanning the QR code returns 410 Gone instead of redirecting. Use this for time-limited promotions, events, or temporary links. Can be removed later via PATCH (set to null).",
      },
      scheduled_url: {
        type: "string",
        description:
          "A replacement destination URL. When scheduled_at is reached, the QR code automatically switches from target_url to this URL. Requires scheduled_at to be set.",
      },
      scheduled_at: {
        type: "string",
        description:
          "ISO 8601 date-time. When this date is reached, the QR code's target automatically switches to scheduled_url. The swap happens lazily on the next scan. Requires scheduled_url to be set.",
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
            "The full short URL that the QR code points to. For type='url', scanning redirects here. For vcard/wifi, this URL serves as a fallback.",
        },
        type: { type: "string", enum: ["url", "vcard", "wifi"], description: "QR code type." },
        target_url: { type: "string", nullable: true, description: "The current destination URL (type='url' only)." },
        vcard_data: { type: "object", nullable: true, additionalProperties: true, description: "Structured contact data (type='vcard' only)." },
        wifi_data: { type: "object", nullable: true, additionalProperties: true, description: "Structured WiFi credentials (type='wifi' only)." },
        label: { type: "string", nullable: true, description: "Optional label." },
        format: { type: "string", description: "Image format (svg or png)." },
        image_data: {
          type: "string",
          description:
            'The QR code image. For SVG format: raw SVG XML string. For PNG format: base64-encoded binary data (prefix with "data:image/png;base64," to use as a data URI).',
        },
        created_at: { type: "string", description: "ISO 8601 creation timestamp." },
        expires_at: { type: "string", nullable: true, description: "ISO 8601 expiration date, or null if no expiration." },
        scheduled_url: { type: "string", nullable: true, description: "Scheduled replacement URL, or null." },
        scheduled_at: { type: "string", nullable: true, description: "ISO 8601 activation date for scheduled_url, or null." },
      },
    },
  },
};

// ---- Bulk schemas ----

const qrItemProperties = qrCreateSchema.body.properties;

export const qrBulkCreateSchema = {
  body: {
    type: "object" as const,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        description: "Array of QR codes to create (max 50). Each item has the same schema as POST /api/qr.",
        items: {
          type: "object" as const,
          properties: qrItemProperties,
        },
      },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        created: { type: "integer", description: "Number of QR codes created." },
        items: {
          type: "array",
          items: qrCreateSchema.response[201],
        },
      },
    },
  },
};

export const qrBulkUpdateSchema = {
  body: {
    type: "object" as const,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        description: "Array of QR codes to update (max 50). Each item requires short_id plus target_url and/or label.",
        items: {
          type: "object" as const,
          required: ["short_id"],
          properties: {
            short_id: { type: "string", description: "The short_id of the QR code to update." },
            target_url: { type: "string", description: "New destination URL." },
            label: { type: "string", description: "New label." },
            expires_at: { type: ["string", "null"], description: "ISO 8601 expiration date. Null to clear." },
            scheduled_url: { type: ["string", "null"], description: "Replacement URL. Null to cancel." },
            scheduled_at: { type: ["string", "null"], description: "ISO 8601 activation date. Null to cancel." },
          },
        },
      },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        updated: { type: "integer" },
        not_found: { type: "integer" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              short_id: { type: "string" },
              status: { type: "string", enum: ["updated", "not_found"] },
              target_url: { type: "string" },
              label: { type: "string" },
            },
          },
        },
      },
    },
  },
};

export const qrBulkDeleteSchema = {
  body: {
    type: "object" as const,
    required: ["short_ids"],
    properties: {
      short_ids: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        description: "Array of short_id strings to delete (max 50).",
        items: { type: "string" },
      },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        deleted: { type: "integer" },
        not_found: { type: "integer" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              short_id: { type: "string" },
              status: { type: "string", enum: ["deleted", "not_found"] },
            },
          },
        },
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
          "New destination URL. Updating this does NOT change the QR code image — the same QR image will now redirect to this new URL. This is the core 'dynamic link' feature. Only valid for type='url' QR codes.",
      },
      label: {
        type: "string",
        description: "Updated label for the QR code.",
      },
      vcard_data: {
        type: "object",
        description: "Update vCard fields. Only valid for type='vcard' QR codes. Partial updates merge with existing data. Note: updating vCard data changes the QR image content.",
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          organization: { type: "string" },
          title: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          url: { type: "string" },
          address: { type: "string" },
          note: { type: "string" },
        },
      },
      wifi_data: {
        type: "object",
        description: "Update WiFi fields. Only valid for type='wifi' QR codes. Note: updating WiFi data changes the QR image content.",
        properties: {
          ssid: { type: "string" },
          password: { type: "string" },
          encryption: { type: "string", enum: ["WPA", "WEP", "nopass"] },
          hidden: { type: "boolean" },
        },
      },
      expires_at: {
        type: ["string", "null"],
        description: "ISO 8601 expiration date. Set to null to remove expiration. Only valid for type='url'.",
      },
      scheduled_url: {
        type: ["string", "null"],
        description: "Replacement URL activated at scheduled_at. Set to null to cancel. Only valid for type='url'.",
      },
      scheduled_at: {
        type: ["string", "null"],
        description: "ISO 8601 activation date for scheduled_url. Set to null to cancel. Only valid for type='url'.",
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
