import { eq, and, count, sql, gt, sum } from "drizzle-orm";
import { db, schema } from "../../db/index.js";

const { conversionEvents, qrCodes } = schema;

const PERIOD_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function getPeriodStart(period: string): string | null {
  const days = PERIOD_DAYS[period];
  if (!days) return null; // "all" → no filter
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function recordConversion(input: {
  qrCodeId: number;
  eventName: string;
  value?: number | null;
  metadata?: Record<string, unknown> | null;
  referer?: string | null;
  ip?: string | null;
}) {
  const inserted = db
    .insert(conversionEvents)
    .values({
      qrCodeId: input.qrCodeId,
      eventName: input.eventName,
      value: input.value != null ? String(input.value) : null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      referer: input.referer ?? null,
      ip: input.ip ?? null,
    })
    .returning()
    .get();

  return {
    id: inserted.id,
    event: inserted.eventName,
    value: inserted.value ? parseFloat(inserted.value) : null,
    metadata: inserted.metadata ? JSON.parse(inserted.metadata) : null,
    created_at: inserted.createdAt,
  };
}

export function getConversions(
  qrCodeId: number,
  shortId: string,
  period: string = "30d",
  eventFilter?: string
) {
  const periodStart = getPeriodStart(period);

  // Build conditions
  const conditions = [eq(conversionEvents.qrCodeId, qrCodeId)];
  if (periodStart) conditions.push(gt(conversionEvents.createdAt, periodStart));
  if (eventFilter) conditions.push(eq(conversionEvents.eventName, eventFilter));

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  // Total conversions
  const [{ total }] = db
    .select({ total: count() })
    .from(conversionEvents)
    .where(whereClause)
    .all();

  // Total value
  const [{ totalValue }] = db
    .select({ totalValue: sql<string | null>`SUM(CAST(${conversionEvents.value} AS REAL))` })
    .from(conversionEvents)
    .where(whereClause)
    .all();

  // By event
  const byEvent = db.all<{ event_name: string; count: number; total_value: string | null }>(
    sql`SELECT ${conversionEvents.eventName} as event_name, COUNT(*) as count,
        SUM(CAST(${conversionEvents.value} AS REAL)) as total_value
        FROM conversion_events
        WHERE ${whereClause}
        GROUP BY ${conversionEvents.eventName}
        ORDER BY count DESC`
  );

  // By day
  const byDay = db.all<{ date: string; count: number; total_value: string | null }>(
    sql`SELECT date(${conversionEvents.createdAt}) as date, COUNT(*) as count,
        SUM(CAST(${conversionEvents.value} AS REAL)) as total_value
        FROM conversion_events
        WHERE ${whereClause}
        GROUP BY date(${conversionEvents.createdAt})
        ORDER BY date ASC`
  );

  // Recent events (last 20)
  const recent = db
    .select()
    .from(conversionEvents)
    .where(whereClause)
    .orderBy(sql`${conversionEvents.createdAt} DESC`)
    .limit(20)
    .all();

  return {
    short_id: shortId,
    total_conversions: total,
    total_value: totalValue ? parseFloat(totalValue) : 0,
    period,
    by_event: byEvent.map((e) => ({
      event_name: e.event_name,
      count: e.count,
      total_value: e.total_value ? parseFloat(e.total_value) : 0,
    })),
    by_day: byDay.map((d) => ({
      date: d.date,
      count: d.count,
      total_value: d.total_value ? parseFloat(d.total_value) : 0,
    })),
    recent_events: recent.map((r) => ({
      event_name: r.eventName,
      value: r.value ? parseFloat(r.value) : null,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
      created_at: r.createdAt,
    })),
  };
}
