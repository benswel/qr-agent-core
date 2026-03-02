/** Supported QR code output formats */
export type QrFormat = "svg" | "png";

/** QR code content types */
export type QrType = "url" | "vcard" | "wifi" | "email" | "sms" | "phone" | "event" | "text" | "location" | "social" | "app_store";

/** Structured vCard data for vCard QR codes */
export interface VCardData {
  first_name: string;
  last_name: string;
  organization?: string;
  title?: string;
  email?: string;
  phone?: string;
  url?: string;
  address?: string;
  note?: string;
}

/** Structured WiFi data for WiFi QR codes */
export interface WiFiData {
  ssid: string;
  password?: string;
  encryption: "WPA" | "WEP" | "nopass";
  hidden?: boolean;
}

/** Structured email data for Email QR codes */
export interface EmailData {
  to: string;
  subject?: string;
  body?: string;
  cc?: string;
  bcc?: string;
}

/** Structured SMS data for SMS QR codes */
export interface SMSData {
  phone_number: string;
  message?: string;
}

/** Structured phone data for Phone QR codes */
export interface PhoneData {
  phone_number: string;
}

/** Structured event data for Event/Calendar QR codes */
export interface EventData {
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

/** Structured text data for plain Text QR codes */
export interface TextData {
  content: string;
}

/** Structured location data for Location QR codes */
export interface LocationData {
  latitude: number;
  longitude: number;
  label?: string;
}

/** Structured social media data for Social QR codes */
export interface SocialData {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  github?: string;
  website?: string;
}

/** Structured app store data for App Store QR codes */
export interface AppStoreData {
  ios_url?: string;
  android_url?: string;
  fallback_url?: string;
}

/** UTM tracking parameters for URL QR codes */
export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

/** Redirect condition types for conditional redirects */
export type RedirectConditionType = "device" | "os" | "country" | "language" | "time_range" | "ab_split";

/** Time range value for time_range conditions */
export interface TimeRangeValue {
  start: string;  // "HH:MM"
  end: string;    // "HH:MM"
  timezone: string; // IANA timezone (e.g. "Europe/Paris")
}

/** A/B split value for ab_split conditions */
export interface AbSplitValue {
  percentage: number; // 0-100
}

/** A redirect condition */
export interface RedirectCondition {
  type: RedirectConditionType;
  value: string | TimeRangeValue | AbSplitValue;
}

/** A redirect rule: one or more conditions (AND logic) + target URL */
export interface RedirectRule {
  conditions: RedirectCondition[];
  target_url: string;
}

/** Gradient options for QR code foreground */
export interface GradientOptions {
  type: "linear" | "radial";
  colors: string[];  // 2+ hex colors, evenly distributed
  angle?: number;    // 0-360, linear only (default: 0 = left-to-right)
}

/** Style options for custom QR code rendering */
export interface QrStyleOptions {
  foreground_color?: string;
  background_color?: string;
  gradient?: GradientOptions;
  width?: number;
  margin?: number;
  error_correction?: "L" | "M" | "Q" | "H";
  dot_style?: "square" | "rounded" | "dots" | "classy-rounded";
  corner_style?: "square" | "extra-rounded" | "dot";
  logo_url?: string;
  logo_size?: number;
}

/** Standard paginated list response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
}

/** Plan types and usage limits */
export type Plan = "free" | "pro";

export const PLAN_LIMITS = {
  free: {
    maxQrCodes: 10,
    maxScansPerMonth: 1000,
    scanGracePeriod: 100,
    maxWebhooks: 1,
  },
  pro: {
    maxQrCodes: Infinity,
    maxScansPerMonth: Infinity,
    scanGracePeriod: 0,
    maxWebhooks: Infinity,
  },
} as const;

/** Augment Fastify request with apiKeyId and plan for multi-tenant scoping */
declare module "fastify" {
  interface FastifyRequest {
    apiKeyId: number;
    plan: Plan;
    rawBody?: Buffer;
  }
}
