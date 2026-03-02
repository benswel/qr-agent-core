import type { VCardData, WiFiData, EmailData, SMSData, PhoneData, EventData, TextData, LocationData } from "../../shared/types.js";

/**
 * Generate a vCard 3.0 string from structured data.
 * This string is encoded directly in the QR matrix.
 */
export function buildVCardString(data: VCardData): string {
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${data.last_name};${data.first_name};;;`,
    `FN:${data.first_name} ${data.last_name}`,
  ];

  if (data.organization) lines.push(`ORG:${data.organization}`);
  if (data.title) lines.push(`TITLE:${data.title}`);
  if (data.email) lines.push(`EMAIL:${data.email}`);
  if (data.phone) lines.push(`TEL;TYPE=CELL:${data.phone}`);
  if (data.url) lines.push(`URL:${data.url}`);
  if (data.address) lines.push(`ADR:;;${data.address};;;;`);
  if (data.note) lines.push(`NOTE:${data.note}`);

  lines.push("END:VCARD");
  return lines.join("\n");
}

/**
 * Generate a WiFi config string from structured data.
 * Format: WIFI:S:<ssid>;T:<encryption>;P:<password>;H:<hidden>;;
 * This string is encoded directly in the QR matrix.
 */
export function buildWiFiString(data: WiFiData): string {
  const parts = [
    `WIFI:S:${escapeWifi(data.ssid)}`,
    `T:${data.encryption}`,
  ];

  if (data.password && data.encryption !== "nopass") {
    parts.push(`P:${escapeWifi(data.password)}`);
  }

  if (data.hidden) {
    parts.push("H:true");
  }

  return parts.join(";") + ";;";
}

/** Escape special characters in WiFi fields: \, ;, , and " */
function escapeWifi(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/"/g, '\\"');
}

/**
 * Generate a mailto: URI from structured email data.
 * Format: mailto:to?subject=X&body=Y&cc=Z&bcc=W
 */
export function buildEmailString(data: EmailData): string {
  const params = new URLSearchParams();
  if (data.subject) params.set("subject", data.subject);
  if (data.body) params.set("body", data.body);
  if (data.cc) params.set("cc", data.cc);
  if (data.bcc) params.set("bcc", data.bcc);
  const query = params.toString();
  return `mailto:${data.to}${query ? "?" + query : ""}`;
}

/**
 * Generate an SMS string from structured data.
 * Format: SMSTO:number:message
 */
export function buildSMSString(data: SMSData): string {
  if (data.message) {
    return `SMSTO:${data.phone_number}:${data.message}`;
  }
  return `SMSTO:${data.phone_number}`;
}

/**
 * Generate a tel: URI from structured phone data.
 * Format: tel:number
 */
export function buildPhoneString(data: PhoneData): string {
  return `tel:${data.phone_number}`;
}

/**
 * Generate an iCalendar VEVENT string from structured event data.
 * The QR matrix encodes this directly for calendar apps to parse.
 */
export function buildEventString(data: EventData): string {
  const lines: string[] = [
    "BEGIN:VEVENT",
    `DTSTART:${toICalDate(data.start)}`,
    `DTEND:${toICalDate(data.end)}`,
    `SUMMARY:${escapeIcal(data.summary)}`,
  ];

  if (data.location) lines.push(`LOCATION:${escapeIcal(data.location)}`);
  if (data.description) lines.push(`DESCRIPTION:${escapeIcal(data.description)}`);

  lines.push("END:VEVENT");
  return lines.join("\n");
}

/**
 * Wrap a VEVENT string in a full iCalendar (VCALENDAR) for .ics file download.
 */
export function buildIcsFile(data: EventData): string {
  const vevent = buildEventString(data);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//QR for Agent//EN",
    vevent,
    "END:VCALENDAR",
  ].join("\n");
}

/**
 * Return plain text content for Text QR codes.
 */
export function buildTextString(data: TextData): string {
  return data.content;
}

/**
 * Generate a geo: URI from structured location data.
 * Format: geo:lat,lng or geo:lat,lng?q=label
 */
export function buildLocationString(data: LocationData): string {
  const base = `geo:${data.latitude},${data.longitude}`;
  if (data.label) {
    return `${base}?q=${encodeURIComponent(data.label)}`;
  }
  return base;
}

/** Convert ISO 8601 date string to iCalendar format (YYYYMMDDTHHMMSSZ) */
function toICalDate(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escape special characters in iCalendar text values */
function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
