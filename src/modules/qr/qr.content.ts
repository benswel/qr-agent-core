import type { VCardData, WiFiData } from "../../shared/types.js";

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
