import { db, schema } from "../../db/index.js";
import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";

const { scanEvents } = schema;

export function recordScan(qrCodeId: number, request: { userAgent?: string; referer?: string; ip?: string }) {
  // Parse user-agent
  let deviceType: string | null = null;
  let browser: string | null = null;
  let os: string | null = null;

  if (request.userAgent) {
    const parsed = (UAParser as unknown as (ua: string) => { device: { type?: string }; browser: { name?: string }; os: { name?: string } })(request.userAgent);

    deviceType = parsed.device.type || "desktop"; // ua-parser returns undefined for desktop
    browser = parsed.browser.name || null;
    os = parsed.os.name || null;
  }

  // Geo lookup
  let country: string | null = null;
  let city: string | null = null;

  if (request.ip && request.ip !== "127.0.0.1") {
    const geo = geoip.lookup(request.ip);
    if (geo) {
      country = geo.country || null;
      city = geo.city || null;
    }
  }

  db.insert(scanEvents)
    .values({
      qrCodeId,
      userAgent: request.userAgent || null,
      referer: request.referer || null,
      ip: request.ip || null,
      deviceType,
      browser,
      os,
      country,
      city,
    })
    .run();
}
