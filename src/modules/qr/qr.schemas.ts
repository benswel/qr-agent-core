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
        enum: ["url", "vcard", "wifi", "email", "sms", "phone", "event", "text", "location", "social", "app_store"],
        default: "url",
        description:
          "QR code type. 'url' (default): redirect short URL. 'vcard': contact card. 'wifi': WiFi credentials. 'email': pre-filled email. 'sms': pre-filled SMS. 'phone': phone call. 'event': calendar event. 'text': plain text. 'location': geographic coordinates. 'social': social media links. 'app_store': smart app store redirect.",
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
      email_data: {
        type: "object",
        description: "Email data for Email QR codes. Required when type='email'. At minimum, 'to' must be provided.",
        properties: {
          to: { type: "string", description: "Recipient email address." },
          subject: { type: "string", description: "Email subject line." },
          body: { type: "string", description: "Email body text." },
          cc: { type: "string", description: "CC recipient(s)." },
          bcc: { type: "string", description: "BCC recipient(s)." },
        },
      },
      sms_data: {
        type: "object",
        description: "SMS data for SMS QR codes. Required when type='sms'. phone_number is required.",
        properties: {
          phone_number: { type: "string", description: "Phone number to send SMS to." },
          message: { type: "string", description: "Pre-filled SMS message text." },
        },
      },
      phone_data: {
        type: "object",
        description: "Phone data for Phone QR codes. Required when type='phone'. phone_number is required.",
        properties: {
          phone_number: { type: "string", description: "Phone number to call." },
        },
      },
      event_data: {
        type: "object",
        description: "Calendar event data for Event QR codes. Required when type='event'. summary, start, and end are required.",
        properties: {
          summary: { type: "string", description: "Event title/summary." },
          start: { type: "string", description: "Event start date-time in ISO 8601 format." },
          end: { type: "string", description: "Event end date-time in ISO 8601 format." },
          location: { type: "string", description: "Event location." },
          description: { type: "string", description: "Event description." },
        },
      },
      text_data: {
        type: "object",
        description: "Text data for plain Text QR codes. Required when type='text'. content is required.",
        properties: {
          content: { type: "string", description: "Plain text content to encode in the QR code." },
        },
      },
      location_data: {
        type: "object",
        description: "Location data for Location QR codes. Required when type='location'. latitude and longitude are required.",
        properties: {
          latitude: { type: "number", description: "Geographic latitude (-90 to 90)." },
          longitude: { type: "number", description: "Geographic longitude (-180 to 180)." },
          label: { type: "string", description: "Human-readable place name." },
        },
      },
      social_data: {
        type: "object",
        description: "Social media links for Social QR codes. Required when type='social'. At least one platform link must be provided.",
        properties: {
          facebook: { type: "string", description: "Facebook profile/page URL." },
          instagram: { type: "string", description: "Instagram profile URL." },
          twitter: { type: "string", description: "Twitter/X profile URL." },
          linkedin: { type: "string", description: "LinkedIn profile URL." },
          youtube: { type: "string", description: "YouTube channel URL." },
          tiktok: { type: "string", description: "TikTok profile URL." },
          github: { type: "string", description: "GitHub profile URL." },
          website: { type: "string", description: "Personal/company website URL." },
        },
      },
      app_store_data: {
        type: "object",
        description: "App store links for App Store QR codes. Required when type='app_store'. At least ios_url or android_url must be provided.",
        properties: {
          ios_url: { type: "string", description: "Apple App Store URL." },
          android_url: { type: "string", description: "Google Play Store URL." },
          fallback_url: { type: "string", description: "Fallback URL for non-mobile devices." },
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
      utm_params: {
        type: "object",
        description:
          "UTM tracking parameters auto-appended to the target URL on redirect. Only applies to type='url'. Set individual params; omitted params are not appended.",
        properties: {
          source: { type: "string", description: "utm_source value (e.g. 'flyer', 'email', 'social')." },
          medium: { type: "string", description: "utm_medium value (e.g. 'print', 'cpc', 'banner')." },
          campaign: { type: "string", description: "utm_campaign value (e.g. 'summer_2026')." },
          term: { type: "string", description: "utm_term value (paid search keyword)." },
          content: { type: "string", description: "utm_content value (A/B test variant identifier)." },
        },
      },
      gtm_container_id: {
        type: "string",
        pattern: "^GTM-[A-Z0-9]+$",
        description:
          "Google Tag Manager container ID (e.g. 'GTM-XXXXXX'). When set, the redirect serves an intermediate HTML page with the GTM snippet before redirecting. This enables GA4/GTM tracking on QR scans. Only applies to type='url'.",
      },
      redirect_rules: {
        type: "array",
        description:
          "Conditional redirect rules evaluated top-to-bottom on each scan. First matching rule's target_url is used; if none match, the default target_url applies. Only for type='url'. Conditions: device (mobile/tablet/desktop), os (iOS/Android/Windows/macOS/Linux), country (ISO 3166-1 alpha-2), language (ISO 639-1 from Accept-Language), time_range ({start,end,timezone}), ab_split ({percentage: 0-100}).",
        items: {
          type: "object",
          properties: {
            condition: {
              type: "object",
              description: "The condition to evaluate.",
              properties: {
                type: { type: "string", enum: ["device", "os", "country", "language", "time_range", "ab_split"], description: "Condition type." },
                value: { description: "Condition value. String for device/os/country/language. Object for time_range ({start,end,timezone}) and ab_split ({percentage})." },
              },
            },
            target_url: { type: "string", description: "URL to redirect to when this rule matches." },
          },
        },
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
        type: { type: "string", enum: ["url", "vcard", "wifi", "email", "sms", "phone", "event", "text", "location", "social", "app_store"], description: "QR code type." },
        target_url: { type: "string", nullable: true, description: "The current destination URL (type='url' only)." },
        vcard_data: { type: "object", nullable: true, additionalProperties: true, description: "Structured contact data (type='vcard' only)." },
        wifi_data: { type: "object", nullable: true, additionalProperties: true, description: "Structured WiFi credentials (type='wifi' only)." },
        email_data: { type: "object", nullable: true, additionalProperties: true, description: "Structured email data (type='email' only)." },
        sms_data: { type: "object", nullable: true, additionalProperties: true, description: "Structured SMS data (type='sms' only)." },
        phone_data: { type: "object", nullable: true, additionalProperties: true, description: "Structured phone data (type='phone' only)." },
        event_data: { type: "object", nullable: true, additionalProperties: true, description: "Structured event data (type='event' only)." },
        text_data: { type: "object", nullable: true, additionalProperties: true, description: "Structured text data (type='text' only)." },
        location_data: { type: "object", nullable: true, additionalProperties: true, description: "Structured location data (type='location' only)." },
        social_data: { type: "object", nullable: true, additionalProperties: true, description: "Structured social media links (type='social' only)." },
        app_store_data: { type: "object", nullable: true, additionalProperties: true, description: "Structured app store links (type='app_store' only)." },
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
        utm_params: { type: "object", nullable: true, additionalProperties: true, description: "UTM tracking parameters (type='url' only)." },
        gtm_container_id: { type: "string", nullable: true, description: "GTM container ID (type='url' only)." },
        redirect_rules: { type: "array", nullable: true, items: { type: "object", additionalProperties: true }, description: "Conditional redirect rules (type='url' only)." },
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
        description: "Array of QR codes to update (max 50). Each item requires short_id plus fields to update.",
        items: {
          type: "object" as const,
          required: ["short_id"],
          properties: {
            short_id: { type: "string", description: "The short_id of the QR code to update." },
            target_url: { type: "string", description: "New destination URL." },
            label: { type: "string", description: "New label." },
            vcard_data: { type: "object", additionalProperties: true },
            wifi_data: { type: "object", additionalProperties: true },
            email_data: { type: "object", additionalProperties: true },
            sms_data: { type: "object", additionalProperties: true },
            phone_data: { type: "object", additionalProperties: true },
            event_data: { type: "object", additionalProperties: true },
            text_data: { type: "object", additionalProperties: true },
            location_data: { type: "object", additionalProperties: true },
            social_data: { type: "object", additionalProperties: true },
            app_store_data: { type: "object", additionalProperties: true },
            expires_at: { type: ["string", "null"], description: "ISO 8601 expiration date. Null to clear." },
            scheduled_url: { type: ["string", "null"], description: "Replacement URL. Null to cancel." },
            scheduled_at: { type: ["string", "null"], description: "ISO 8601 activation date. Null to cancel." },
            utm_params: { type: ["object", "null"], additionalProperties: true },
            gtm_container_id: { type: ["string", "null"] },
            redirect_rules: { type: ["array", "null"], items: { type: "object", additionalProperties: true } },
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
      email_data: {
        type: "object",
        description: "Update email fields. Only valid for type='email' QR codes.",
        properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, cc: { type: "string" }, bcc: { type: "string" } },
      },
      sms_data: {
        type: "object",
        description: "Update SMS fields. Only valid for type='sms' QR codes.",
        properties: { phone_number: { type: "string" }, message: { type: "string" } },
      },
      phone_data: {
        type: "object",
        description: "Update phone fields. Only valid for type='phone' QR codes.",
        properties: { phone_number: { type: "string" } },
      },
      event_data: {
        type: "object",
        description: "Update event fields. Only valid for type='event' QR codes.",
        properties: { summary: { type: "string" }, start: { type: "string" }, end: { type: "string" }, location: { type: "string" }, description: { type: "string" } },
      },
      text_data: {
        type: "object",
        description: "Update text content. Only valid for type='text' QR codes.",
        properties: { content: { type: "string" } },
      },
      location_data: {
        type: "object",
        description: "Update location fields. Only valid for type='location' QR codes.",
        properties: { latitude: { type: "number" }, longitude: { type: "number" }, label: { type: "string" } },
      },
      social_data: {
        type: "object",
        description: "Update social media links. Only valid for type='social' QR codes.",
        properties: { facebook: { type: "string" }, instagram: { type: "string" }, twitter: { type: "string" }, linkedin: { type: "string" }, youtube: { type: "string" }, tiktok: { type: "string" }, github: { type: "string" }, website: { type: "string" } },
      },
      app_store_data: {
        type: "object",
        description: "Update app store URLs. Only valid for type='app_store' QR codes.",
        properties: { ios_url: { type: "string" }, android_url: { type: "string" }, fallback_url: { type: "string" } },
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
      utm_params: {
        type: ["object", "null"],
        description: "UTM tracking parameters. Set to null to clear. Only valid for type='url'.",
        properties: {
          source: { type: "string" }, medium: { type: "string" }, campaign: { type: "string" },
          term: { type: "string" }, content: { type: "string" },
        },
      },
      gtm_container_id: {
        type: ["string", "null"],
        pattern: "^GTM-[A-Z0-9]+$",
        description: "GTM container ID. Set to null to clear. Only valid for type='url'.",
      },
      redirect_rules: {
        type: ["array", "null"],
        description: "Conditional redirect rules. Set to null to clear. Only valid for type='url'.",
        items: {
          type: "object",
          properties: {
            condition: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["device", "os", "country", "language", "time_range", "ab_split"] },
                value: {},
              },
            },
            target_url: { type: "string" },
          },
        },
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
