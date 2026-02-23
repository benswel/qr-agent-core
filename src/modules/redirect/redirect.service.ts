import { db, schema } from "../../db/index.js";

const { scanEvents } = schema;

export function recordScan(qrCodeId: number, request: { userAgent?: string; referer?: string; ip?: string }) {
  db.insert(scanEvents)
    .values({
      qrCodeId,
      userAgent: request.userAgent || null,
      referer: request.referer || null,
      ip: request.ip || null,
    })
    .run();
}
