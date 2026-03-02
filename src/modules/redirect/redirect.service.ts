import { db, schema } from "../../db/index.js";
import type { ParsedRequest } from "./redirect.utils.js";
import { parseRequest } from "./redirect.utils.js";

const { scanEvents } = schema;

export function recordScan(
  qrCodeId: number,
  request: { userAgent?: string; referer?: string; ip?: string },
  preParsed?: ParsedRequest
) {
  // Use pre-parsed data if available, otherwise parse from scratch
  const parsed = preParsed ?? parseRequest(request.userAgent, request.ip);

  db.insert(scanEvents)
    .values({
      qrCodeId,
      userAgent: request.userAgent || null,
      referer: request.referer || null,
      ip: request.ip || null,
      deviceType: parsed.deviceType,
      browser: parsed.browser,
      os: parsed.os,
      country: parsed.country,
      city: parsed.city,
    })
    .run();
}
