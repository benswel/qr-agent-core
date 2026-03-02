import { z } from "zod";
import { apiRequest } from "./api-client.js";

/**
 * MCP tool definitions for QR Agent Core.
 * Each tool calls the production HTTP API.
 */
export const tools = {
  create_qr_code: {
    description:
      "Create a new managed QR code with optional custom styling. The QR code points to a short URL that redirects to your target URL. You can change the target URL later without regenerating the QR image. Supports custom colors, dot shapes, corner shapes, and logo embedding.",
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
      foreground_color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional()
        .describe("Hex color for QR code dots. Default: #000000 (black)."),
      background_color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional()
        .describe("Hex color for QR code background. Default: #ffffff (white)."),
      width: z
        .number()
        .min(200)
        .max(2000)
        .optional()
        .describe("QR code width in pixels. Default: 400."),
      margin: z
        .number()
        .min(0)
        .max(10)
        .optional()
        .describe("Quiet zone margin in modules. Default: 2."),
      error_correction: z
        .enum(["L", "M", "Q", "H"])
        .optional()
        .describe("Error correction level. L=7%, M=15% (default), Q=25%, H=30%. Auto-set to H when logo is provided."),
      dot_style: z
        .enum(["square", "rounded", "dots", "classy-rounded"])
        .optional()
        .describe("Shape of data modules. square=classic, rounded=soft corners, dots=circles, classy-rounded=organic."),
      corner_style: z
        .enum(["square", "extra-rounded", "dot"])
        .optional()
        .describe("Shape of finder patterns (corner squares). square=classic, extra-rounded=smooth, dot=circular."),
      logo_url: z
        .string()
        .optional()
        .describe("URL to a logo image (PNG/JPG/SVG) or data:base64 URI. Centered on the QR code."),
      logo_size: z
        .number()
        .min(0.15)
        .max(0.3)
        .optional()
        .describe("Logo size as ratio of QR width (0.15-0.3). Default: 0.2."),
      expires_at: z
        .string()
        .optional()
        .describe("ISO 8601 date-time. After this date, scanning returns 410 Gone instead of redirecting."),
      scheduled_url: z
        .string()
        .url()
        .optional()
        .describe("Replacement URL that activates at scheduled_at."),
      scheduled_at: z
        .string()
        .optional()
        .describe("ISO 8601 date-time when target automatically switches to scheduled_url."),
    }),
    handler: async (input: Record<string, unknown>) => {
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
      expires_at: z
        .string()
        .nullable()
        .optional()
        .describe("ISO 8601 expiration date. Set to null to remove expiration."),
      scheduled_url: z
        .string()
        .url()
        .nullable()
        .optional()
        .describe("Scheduled replacement URL. Set to null to cancel."),
      scheduled_at: z
        .string()
        .nullable()
        .optional()
        .describe("ISO 8601 activation date for scheduled_url. Set to null to cancel."),
    }),
    handler: async (input: { short_id: string; target_url: string; label?: string; expires_at?: string | null; scheduled_url?: string | null; scheduled_at?: string | null }) => {
      const body: Record<string, unknown> = { target_url: input.target_url, label: input.label };
      if (input.expires_at !== undefined) body.expires_at = input.expires_at;
      if (input.scheduled_url !== undefined) body.scheduled_url = input.scheduled_url;
      if (input.scheduled_at !== undefined) body.scheduled_at = input.scheduled_at;
      return apiRequest(`/api/qr/${input.short_id}`, {
        method: "PATCH",
        body,
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
      "Get enriched scan analytics for a QR code. Returns total scans, daily trends, device/browser/country/referer breakdowns with percentages, and recent scan events with parsed user-agent and geo data.",
    inputSchema: z.object({
      short_id: z.string().describe("The short ID of the QR code to get analytics for."),
      period: z
        .enum(["7d", "30d", "90d", "all"])
        .default("30d")
        .describe("Time period for aggregations. Default: 30d."),
    }),
    handler: async (input: { short_id: string; period: string }) => {
      return apiRequest(`/api/analytics/${input.short_id}`, { query: { period: input.period } });
    },
  },

  bulk_create_qr_codes: {
    description:
      "Create multiple QR codes in a single request (up to 50). Each item supports the same options as create_qr_code. The quota check is all-or-nothing: if the batch would exceed your plan limit, no QR codes are created. Ideal for generating QR codes for product catalogs, event lists, or batch operations.",
    inputSchema: z.object({
      items: z
        .array(
          z.object({
            target_url: z.string().url().describe("The destination URL."),
            label: z.string().optional().describe("Optional label."),
            format: z.enum(["svg", "png"]).default("svg").describe("Image format."),
            foreground_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for dots."),
            background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for background."),
            dot_style: z.enum(["square", "rounded", "dots", "classy-rounded"]).optional().describe("Dot shape."),
            corner_style: z.enum(["square", "extra-rounded", "dot"]).optional().describe("Corner shape."),
            logo_url: z.string().optional().describe("Logo URL or data URI."),
            expires_at: z.string().optional().describe("ISO 8601 expiration date."),
            scheduled_url: z.string().url().optional().describe("Replacement URL activated at scheduled_at."),
            scheduled_at: z.string().optional().describe("ISO 8601 activation date for scheduled_url."),
          })
        )
        .min(1)
        .max(50)
        .describe("Array of QR codes to create. Max 50 per request."),
    }),
    handler: async (input: Record<string, unknown>) => {
      return apiRequest("/api/qr/bulk", { method: "POST", body: input });
    },
  },

  bulk_update_qr_codes: {
    description:
      "Update multiple QR codes in a single request (up to 50). Change target URLs and/or labels. Items with non-existent short_id are reported as not_found without failing the whole batch.",
    inputSchema: z.object({
      items: z
        .array(
          z.object({
            short_id: z.string().describe("The short_id of the QR code to update."),
            target_url: z.string().url().optional().describe("New destination URL."),
            label: z.string().optional().describe("New label."),
            expires_at: z.string().nullable().optional().describe("ISO 8601 expiration date. Null to clear."),
            scheduled_url: z.string().url().nullable().optional().describe("Replacement URL. Null to cancel."),
            scheduled_at: z.string().nullable().optional().describe("ISO 8601 activation date. Null to cancel."),
          })
        )
        .min(1)
        .max(50)
        .describe("Array of QR code updates. Max 50 per request."),
    }),
    handler: async (input: Record<string, unknown>) => {
      return apiRequest("/api/qr/bulk", { method: "PATCH", body: input });
    },
  },

  bulk_delete_qr_codes: {
    description:
      "Delete multiple QR codes and their scan analytics in a single request (up to 50). Items with non-existent short_id are reported as not_found without failing the whole batch.",
    inputSchema: z.object({
      short_ids: z
        .array(z.string())
        .min(1)
        .max(50)
        .describe("Array of short_id strings to delete. Max 50 per request."),
    }),
    handler: async (input: Record<string, unknown>) => {
      return apiRequest("/api/qr/bulk", { method: "DELETE", body: input });
    },
  },

  create_vcard_qr: {
    description:
      "Create a QR code that encodes a contact card (vCard). When scanned by a phone camera, it prompts the user to save the contact. Supports all standard vCard fields and custom QR styling.",
    inputSchema: z.object({
      first_name: z.string().describe("Contact first name."),
      last_name: z.string().describe("Contact last name."),
      organization: z.string().optional().describe("Company or organization."),
      title: z.string().optional().describe("Job title."),
      email: z.string().optional().describe("Email address."),
      phone: z.string().optional().describe("Phone number."),
      url: z.string().optional().describe("Website URL."),
      address: z.string().optional().describe("Street address."),
      note: z.string().optional().describe("Additional notes."),
      label: z.string().optional().describe("Label for this QR code."),
      format: z.enum(["svg", "png"]).default("svg").describe("Image format."),
      foreground_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for dots."),
      background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for background."),
      dot_style: z.enum(["square", "rounded", "dots", "classy-rounded"]).optional().describe("Dot shape."),
      corner_style: z.enum(["square", "extra-rounded", "dot"]).optional().describe("Corner shape."),
      logo_url: z.string().optional().describe("Logo URL or data URI."),
    }),
    handler: async (input: Record<string, unknown>) => {
      const { first_name, last_name, organization, title, email, phone, url, address, note, ...rest } = input;
      return apiRequest("/api/qr", {
        method: "POST",
        body: {
          type: "vcard",
          vcard_data: { first_name, last_name, organization, title, email, phone, url, address, note },
          ...rest,
        },
      });
    },
  },

  create_wifi_qr: {
    description:
      "Create a QR code that encodes WiFi credentials. When scanned by a phone camera, it offers to auto-join the WiFi network. No internet connection needed to join — the credentials are encoded directly in the QR image.",
    inputSchema: z.object({
      ssid: z.string().describe("WiFi network name (SSID)."),
      password: z.string().optional().describe("WiFi password. Omit for open networks (use encryption='nopass')."),
      encryption: z.enum(["WPA", "WEP", "nopass"]).default("WPA").describe("Encryption type. Default: WPA."),
      hidden: z.boolean().optional().describe("Whether the network is hidden. Default: false."),
      label: z.string().optional().describe("Label for this QR code."),
      format: z.enum(["svg", "png"]).default("svg").describe("Image format."),
      foreground_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for dots."),
      background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for background."),
      dot_style: z.enum(["square", "rounded", "dots", "classy-rounded"]).optional().describe("Dot shape."),
      corner_style: z.enum(["square", "extra-rounded", "dot"]).optional().describe("Corner shape."),
      logo_url: z.string().optional().describe("Logo URL or data URI."),
    }),
    handler: async (input: Record<string, unknown>) => {
      const { ssid, password, encryption, hidden, ...rest } = input;
      return apiRequest("/api/qr", {
        method: "POST",
        body: {
          type: "wifi",
          wifi_data: { ssid, password, encryption, hidden },
          ...rest,
        },
      });
    },
  },

  update_vcard_qr: {
    description:
      "Update the contact details of a vCard QR code. Only works on QR codes created with type='vcard'. Partial updates merge with existing data. Note: updating vCard data changes the QR image content.",
    inputSchema: z.object({
      short_id: z.string().describe("The short ID of the vCard QR code to update."),
      first_name: z.string().optional().describe("Contact first name."),
      last_name: z.string().optional().describe("Contact last name."),
      organization: z.string().optional().describe("Company or organization."),
      title: z.string().optional().describe("Job title."),
      email: z.string().optional().describe("Email address."),
      phone: z.string().optional().describe("Phone number."),
      url: z.string().optional().describe("Website URL."),
      address: z.string().optional().describe("Street address."),
      note: z.string().optional().describe("Additional notes."),
      label: z.string().optional().describe("Update the label."),
    }),
    handler: async (input: Record<string, unknown>) => {
      const { short_id, label, ...vcardFields } = input;
      const body: Record<string, unknown> = { vcard_data: vcardFields };
      if (label !== undefined) body.label = label;
      return apiRequest(`/api/qr/${short_id}`, { method: "PATCH", body });
    },
  },

  update_wifi_qr: {
    description:
      "Update the WiFi credentials of a WiFi QR code. Only works on QR codes created with type='wifi'. Note: updating WiFi data changes the QR image content.",
    inputSchema: z.object({
      short_id: z.string().describe("The short ID of the WiFi QR code to update."),
      ssid: z.string().optional().describe("WiFi network name."),
      password: z.string().optional().describe("WiFi password."),
      encryption: z.enum(["WPA", "WEP", "nopass"]).optional().describe("Encryption type."),
      hidden: z.boolean().optional().describe("Whether the network is hidden."),
      label: z.string().optional().describe("Update the label."),
    }),
    handler: async (input: Record<string, unknown>) => {
      const { short_id, label, ...wifiFields } = input;
      const body: Record<string, unknown> = { wifi_data: wifiFields };
      if (label !== undefined) body.label = label;
      return apiRequest(`/api/qr/${short_id}`, { method: "PATCH", body });
    },
  },

  create_email_qr: {
    description:
      "Create a QR code that opens a pre-filled email when scanned. The recipient, subject, body, CC, and BCC can all be pre-set.",
    inputSchema: z.object({
      to: z.string().describe("Recipient email address."),
      subject: z.string().optional().describe("Email subject line."),
      body: z.string().optional().describe("Email body text."),
      cc: z.string().optional().describe("CC recipient(s)."),
      bcc: z.string().optional().describe("BCC recipient(s)."),
      label: z.string().optional().describe("Label for this QR code."),
      format: z.enum(["svg", "png"]).default("svg").describe("Image format."),
      foreground_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for dots."),
      background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for background."),
      dot_style: z.enum(["square", "rounded", "dots", "classy-rounded"]).optional().describe("Dot shape."),
      corner_style: z.enum(["square", "extra-rounded", "dot"]).optional().describe("Corner shape."),
      logo_url: z.string().optional().describe("Logo URL or data URI."),
    }),
    handler: async (input: Record<string, unknown>) => {
      const { to, subject, body, cc, bcc, ...rest } = input;
      return apiRequest("/api/qr", {
        method: "POST",
        body: { type: "email", email_data: { to, subject, body, cc, bcc }, ...rest },
      });
    },
  },

  create_sms_qr: {
    description:
      "Create a QR code that opens a pre-filled SMS message when scanned. Set the phone number and optional message text.",
    inputSchema: z.object({
      phone_number: z.string().describe("Phone number to send SMS to."),
      message: z.string().optional().describe("Pre-filled SMS message text."),
      label: z.string().optional().describe("Label for this QR code."),
      format: z.enum(["svg", "png"]).default("svg").describe("Image format."),
      foreground_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for dots."),
      background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for background."),
      dot_style: z.enum(["square", "rounded", "dots", "classy-rounded"]).optional().describe("Dot shape."),
      corner_style: z.enum(["square", "extra-rounded", "dot"]).optional().describe("Corner shape."),
      logo_url: z.string().optional().describe("Logo URL or data URI."),
    }),
    handler: async (input: Record<string, unknown>) => {
      const { phone_number, message, ...rest } = input;
      return apiRequest("/api/qr", {
        method: "POST",
        body: { type: "sms", sms_data: { phone_number, message }, ...rest },
      });
    },
  },

  create_phone_qr: {
    description:
      "Create a QR code that initiates a phone call when scanned. The phone number is encoded directly in the QR code.",
    inputSchema: z.object({
      phone_number: z.string().describe("Phone number to call."),
      label: z.string().optional().describe("Label for this QR code."),
      format: z.enum(["svg", "png"]).default("svg").describe("Image format."),
      foreground_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for dots."),
      background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for background."),
      dot_style: z.enum(["square", "rounded", "dots", "classy-rounded"]).optional().describe("Dot shape."),
      corner_style: z.enum(["square", "extra-rounded", "dot"]).optional().describe("Corner shape."),
      logo_url: z.string().optional().describe("Logo URL or data URI."),
    }),
    handler: async (input: Record<string, unknown>) => {
      const { phone_number, ...rest } = input;
      return apiRequest("/api/qr", {
        method: "POST",
        body: { type: "phone", phone_data: { phone_number }, ...rest },
      });
    },
  },

  create_event_qr: {
    description:
      "Create a QR code that adds a calendar event when scanned. Encodes a standard iCalendar VEVENT that calendar apps can import.",
    inputSchema: z.object({
      summary: z.string().describe("Event title/summary."),
      start: z.string().describe("Event start date-time in ISO 8601 format (e.g. 2026-03-15T09:00:00Z)."),
      end: z.string().describe("Event end date-time in ISO 8601 format."),
      location: z.string().optional().describe("Event location."),
      description: z.string().optional().describe("Event description."),
      label: z.string().optional().describe("Label for this QR code."),
      format: z.enum(["svg", "png"]).default("svg").describe("Image format."),
      foreground_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for dots."),
      background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for background."),
      dot_style: z.enum(["square", "rounded", "dots", "classy-rounded"]).optional().describe("Dot shape."),
      corner_style: z.enum(["square", "extra-rounded", "dot"]).optional().describe("Corner shape."),
      logo_url: z.string().optional().describe("Logo URL or data URI."),
    }),
    handler: async (input: Record<string, unknown>) => {
      const { summary, start, end, location, description, ...rest } = input;
      return apiRequest("/api/qr", {
        method: "POST",
        body: { type: "event", event_data: { summary, start, end, location, description }, ...rest },
      });
    },
  },

  create_text_qr: {
    description:
      "Create a QR code that contains plain text. When scanned, the text is displayed directly. Useful for messages, notes, or any freeform content.",
    inputSchema: z.object({
      content: z.string().describe("Plain text content to encode."),
      label: z.string().optional().describe("Label for this QR code."),
      format: z.enum(["svg", "png"]).default("svg").describe("Image format."),
      foreground_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for dots."),
      background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for background."),
      dot_style: z.enum(["square", "rounded", "dots", "classy-rounded"]).optional().describe("Dot shape."),
      corner_style: z.enum(["square", "extra-rounded", "dot"]).optional().describe("Corner shape."),
      logo_url: z.string().optional().describe("Logo URL or data URI."),
    }),
    handler: async (input: Record<string, unknown>) => {
      const { content, ...rest } = input;
      return apiRequest("/api/qr", {
        method: "POST",
        body: { type: "text", text_data: { content }, ...rest },
      });
    },
  },

  create_location_qr: {
    description:
      "Create a QR code that opens a map location when scanned. Encodes geographic coordinates that map apps can parse.",
    inputSchema: z.object({
      latitude: z.number().min(-90).max(90).describe("Geographic latitude (-90 to 90)."),
      longitude: z.number().min(-180).max(180).describe("Geographic longitude (-180 to 180)."),
      label: z.string().optional().describe("Human-readable place name (shown on map)."),
      qr_label: z.string().optional().describe("Label for this QR code (internal)."),
      format: z.enum(["svg", "png"]).default("svg").describe("Image format."),
      foreground_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for dots."),
      background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for background."),
      dot_style: z.enum(["square", "rounded", "dots", "classy-rounded"]).optional().describe("Dot shape."),
      corner_style: z.enum(["square", "extra-rounded", "dot"]).optional().describe("Corner shape."),
      logo_url: z.string().optional().describe("Logo URL or data URI."),
    }),
    handler: async (input: Record<string, unknown>) => {
      const { latitude, longitude, label, qr_label, ...rest } = input;
      return apiRequest("/api/qr", {
        method: "POST",
        body: { type: "location", location_data: { latitude, longitude, label }, label: qr_label, ...rest },
      });
    },
  },

  create_social_qr: {
    description:
      "Create a QR code that links to social media profiles. When scanned via the short URL, returns a JSON object with all platform links. Provide at least one platform link.",
    inputSchema: z.object({
      facebook: z.string().optional().describe("Facebook profile/page URL."),
      instagram: z.string().optional().describe("Instagram profile URL."),
      twitter: z.string().optional().describe("Twitter/X profile URL."),
      linkedin: z.string().optional().describe("LinkedIn profile URL."),
      youtube: z.string().optional().describe("YouTube channel URL."),
      tiktok: z.string().optional().describe("TikTok profile URL."),
      github: z.string().optional().describe("GitHub profile URL."),
      website: z.string().optional().describe("Personal/company website URL."),
      label: z.string().optional().describe("Label for this QR code."),
      format: z.enum(["svg", "png"]).default("svg").describe("Image format."),
      foreground_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for dots."),
      background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for background."),
      dot_style: z.enum(["square", "rounded", "dots", "classy-rounded"]).optional().describe("Dot shape."),
      corner_style: z.enum(["square", "extra-rounded", "dot"]).optional().describe("Corner shape."),
      logo_url: z.string().optional().describe("Logo URL or data URI."),
    }),
    handler: async (input: Record<string, unknown>) => {
      const { facebook, instagram, twitter, linkedin, youtube, tiktok, github, website, ...rest } = input;
      return apiRequest("/api/qr", {
        method: "POST",
        body: { type: "social", social_data: { facebook, instagram, twitter, linkedin, youtube, tiktok, github, website }, ...rest },
      });
    },
  },

  create_app_store_qr: {
    description:
      "Create a QR code that redirects to the correct app store based on the device. iPhones go to the App Store, Android devices go to Google Play, and other devices go to the fallback URL. Provide at least one store URL.",
    inputSchema: z.object({
      ios_url: z.string().optional().describe("Apple App Store URL."),
      android_url: z.string().optional().describe("Google Play Store URL."),
      fallback_url: z.string().optional().describe("Fallback URL for non-mobile devices."),
      label: z.string().optional().describe("Label for this QR code."),
      format: z.enum(["svg", "png"]).default("svg").describe("Image format."),
      foreground_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for dots."),
      background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex color for background."),
      dot_style: z.enum(["square", "rounded", "dots", "classy-rounded"]).optional().describe("Dot shape."),
      corner_style: z.enum(["square", "extra-rounded", "dot"]).optional().describe("Corner shape."),
      logo_url: z.string().optional().describe("Logo URL or data URI."),
    }),
    handler: async (input: Record<string, unknown>) => {
      const { ios_url, android_url, fallback_url, ...rest } = input;
      return apiRequest("/api/qr", {
        method: "POST",
        body: { type: "app_store", app_store_data: { ios_url, android_url, fallback_url }, ...rest },
      });
    },
  },

  update_social_qr: {
    description:
      "Update the social media links of a Social QR code. Partial updates merge with existing data.",
    inputSchema: z.object({
      short_id: z.string().describe("The short ID of the Social QR code to update."),
      facebook: z.string().optional().describe("Facebook URL."),
      instagram: z.string().optional().describe("Instagram URL."),
      twitter: z.string().optional().describe("Twitter/X URL."),
      linkedin: z.string().optional().describe("LinkedIn URL."),
      youtube: z.string().optional().describe("YouTube URL."),
      tiktok: z.string().optional().describe("TikTok URL."),
      github: z.string().optional().describe("GitHub URL."),
      website: z.string().optional().describe("Website URL."),
      label: z.string().optional().describe("Update the label."),
    }),
    handler: async (input: Record<string, unknown>) => {
      const { short_id, label, ...socialFields } = input;
      const body: Record<string, unknown> = { social_data: socialFields };
      if (label !== undefined) body.label = label;
      return apiRequest(`/api/qr/${short_id}`, { method: "PATCH", body });
    },
  },

  update_app_store_qr: {
    description:
      "Update the app store URLs of an App Store QR code. Partial updates merge with existing data.",
    inputSchema: z.object({
      short_id: z.string().describe("The short ID of the App Store QR code to update."),
      ios_url: z.string().optional().describe("Apple App Store URL."),
      android_url: z.string().optional().describe("Google Play Store URL."),
      fallback_url: z.string().optional().describe("Fallback URL."),
      label: z.string().optional().describe("Update the label."),
    }),
    handler: async (input: Record<string, unknown>) => {
      const { short_id, label, ...appStoreFields } = input;
      const body: Record<string, unknown> = { app_store_data: appStoreFields };
      if (label !== undefined) body.label = label;
      return apiRequest(`/api/qr/${short_id}`, { method: "PATCH", body });
    },
  },

  create_webhook: {
    description:
      "Register a webhook endpoint to receive real-time notifications when QR codes are scanned. Returns an HMAC-SHA256 secret for verifying webhook signatures — store it securely, it is only shown once.",
    inputSchema: z.object({
      url: z
        .string()
        .url()
        .describe("The endpoint URL that will receive POST requests with scan event data."),
      events: z
        .array(z.enum(["qr.scanned"]))
        .default(["qr.scanned"])
        .describe('Events to subscribe to. Currently supported: "qr.scanned".'),
    }),
    handler: async (input: { url: string; events?: string[] }) => {
      return apiRequest("/api/webhooks", { method: "POST", body: input });
    },
  },

  list_webhooks: {
    description:
      "List all registered webhook endpoints for your API key. The HMAC secret is not included for security.",
    inputSchema: z.object({}),
    handler: async () => {
      return apiRequest("/api/webhooks");
    },
  },

  delete_webhook: {
    description:
      "Delete a webhook endpoint and all its delivery logs. The endpoint will stop receiving events immediately.",
    inputSchema: z.object({
      webhook_id: z
        .number()
        .describe("The ID of the webhook to delete. Use list_webhooks to find IDs."),
    }),
    handler: async (input: { webhook_id: number }) => {
      return apiRequest(`/api/webhooks/${input.webhook_id}`, { method: "DELETE" });
    },
  },

  register: {
    description:
      "Register for an API key. Provide your email to get a key immediately.",
    inputSchema: z.object({
      email: z.string().email().describe("Your email address."),
      label: z
        .string()
        .optional()
        .describe("An optional label to identify this API key."),
    }),
    handler: async (input: { email: string; label?: string }) => {
      return apiRequest("/api/register", { method: "POST", body: input });
    },
  },

  get_usage: {
    description:
      "Get current usage and quota for your API key.",
    inputSchema: z.object({}),
    handler: async () => {
      return apiRequest("/api/usage");
    },
  },

  upgrade_to_pro: {
    description:
      "Upgrade to the Pro plan ($19/month) for unlimited QR codes, scans, and webhooks. Returns a Stripe Checkout URL — tell the user to open it in their browser to complete payment. The upgrade takes effect automatically after payment.",
    inputSchema: z.object({}),
    handler: async () => {
      return apiRequest("/api/stripe/checkout", { method: "POST" });
    },
  },

  manage_billing: {
    description:
      "Open the Stripe billing portal to manage your subscription, update payment method, or cancel. Returns a portal URL — tell the user to open it in their browser. Only works if you have an active Pro subscription.",
    inputSchema: z.object({}),
    handler: async () => {
      return apiRequest("/api/stripe/portal", { method: "POST" });
    },
  },
};
