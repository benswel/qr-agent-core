import type { FastifyInstance } from "fastify";
import { eq, and, count, sql, gt } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { sendError, Errors } from "../../shared/errors.js";

const { qrCodes, scanEvents, conversionEvents } = schema;

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

function extractDomain(referer: string | null): string {
  if (!referer) return "(direct)";
  try {
    return new URL(referer).hostname;
  } catch {
    return referer;
  }
}

function withPercentage<T extends { count: number }>(items: T[], total: number): (T & { percentage: number })[] {
  return items.map((item) => ({
    ...item,
    percentage: total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0,
  }));
}

export async function analyticsRoutes(app: FastifyInstance) {
  // GET scan analytics for a specific QR code
  app.get(
    "/:shortId",
    {
      schema: {
        params: {
          type: "object" as const,
          required: ["shortId"],
          properties: {
            shortId: {
              type: "string",
              description: "The short_id of the QR code to get analytics for.",
            },
          },
        },
        querystring: {
          type: "object" as const,
          properties: {
            period: {
              type: "string",
              enum: ["7d", "30d", "90d", "all"],
              default: "30d",
              description: "Time period for aggregations. Default: 30d.",
            },
          },
        },
        tags: ["Analytics"],
        summary: "Get enriched scan analytics for a QR code",
        description:
          "Returns scan statistics with breakdowns by device, browser, country, referer, and daily trends. Includes the 50 most recent scans with parsed user-agent and geo data.",
      },
    },
    async (request, reply) => {
      const { shortId } = request.params as { shortId: string };
      const { period = "30d" } = request.query as { period?: string };

      // Verify the QR code belongs to this API key
      const qr = db
        .select()
        .from(qrCodes)
        .where(and(eq(qrCodes.shortId, shortId), eq(qrCodes.apiKeyId, request.apiKeyId)))
        .get();

      if (!qr) {
        return sendError(reply, 404, Errors.notFound("QR code", shortId));
      }

      const periodStart = getPeriodStart(period);

      // Base condition: scans for this QR code
      const baseCondition = eq(scanEvents.qrCodeId, qr.id);
      const periodCondition = periodStart
        ? and(baseCondition, gt(scanEvents.scannedAt, periodStart))
        : baseCondition;

      // Total scans (all time)
      const [{ totalScans }] = db
        .select({ totalScans: count() })
        .from(scanEvents)
        .where(baseCondition)
        .all();

      // Total scans in period (for percentages)
      const [{ periodTotal }] = db
        .select({ periodTotal: count() })
        .from(scanEvents)
        .where(periodCondition)
        .all();

      // Scans by day
      const scansByDay = db.all<{ date: string; count: number }>(
        sql`SELECT date(${scanEvents.scannedAt}) as date, COUNT(*) as count
            FROM scan_events
            WHERE ${periodCondition}
            GROUP BY date(${scanEvents.scannedAt})
            ORDER BY date ASC`
      );

      // Top devices
      const topDevicesRaw = db.all<{ device_type: string | null; count: number }>(
        sql`SELECT ${scanEvents.deviceType} as device_type, COUNT(*) as count
            FROM scan_events
            WHERE ${periodCondition}
            GROUP BY ${scanEvents.deviceType}
            ORDER BY count DESC
            LIMIT 10`
      );
      const topDevices = withPercentage(
        topDevicesRaw.map((d) => ({ device_type: d.device_type || "unknown", count: d.count })),
        periodTotal
      );

      // Top browsers
      const topBrowsersRaw = db.all<{ browser: string | null; count: number }>(
        sql`SELECT ${scanEvents.browser} as browser, COUNT(*) as count
            FROM scan_events
            WHERE ${periodCondition} AND ${scanEvents.browser} IS NOT NULL
            GROUP BY ${scanEvents.browser}
            ORDER BY count DESC
            LIMIT 10`
      );
      const topBrowsers = withPercentage(topBrowsersRaw.map((b) => ({
        browser: b.browser || "unknown",
        count: b.count,
      })), periodTotal);

      // Top countries
      const topCountriesRaw = db.all<{ country: string | null; count: number }>(
        sql`SELECT ${scanEvents.country} as country, COUNT(*) as count
            FROM scan_events
            WHERE ${periodCondition} AND ${scanEvents.country} IS NOT NULL
            GROUP BY ${scanEvents.country}
            ORDER BY count DESC
            LIMIT 10`
      );
      const topCountries = withPercentage(topCountriesRaw.map((c) => ({
        country: c.country || "unknown",
        count: c.count,
      })), periodTotal);

      // Top referers (extract domain)
      const topReferersRaw = db.all<{ referer: string | null; count: number }>(
        sql`SELECT ${scanEvents.referer} as referer, COUNT(*) as count
            FROM scan_events
            WHERE ${periodCondition}
            GROUP BY ${scanEvents.referer}
            ORDER BY count DESC
            LIMIT 20`
      );
      // Group by domain (multiple full URLs → same domain)
      const domainMap = new Map<string, number>();
      for (const r of topReferersRaw) {
        const domain = extractDomain(r.referer);
        domainMap.set(domain, (domainMap.get(domain) || 0) + r.count);
      }
      const topReferers = withPercentage(
        Array.from(domainMap.entries())
          .map(([referer, cnt]) => ({ referer, count: cnt }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        periodTotal
      );

      // Recent scans (enriched)
      const recentScans = db
        .select()
        .from(scanEvents)
        .where(baseCondition)
        .orderBy(sql`${scanEvents.scannedAt} DESC`)
        .limit(50)
        .all();

      // Conversion summary
      const conversionCondition = periodStart
        ? and(eq(conversionEvents.qrCodeId, qr.id), gt(conversionEvents.createdAt, periodStart))
        : eq(conversionEvents.qrCodeId, qr.id);

      const [{ totalConversions }] = db
        .select({ totalConversions: count() })
        .from(conversionEvents)
        .where(conversionCondition)
        .all();

      const [{ totalValue }] = db
        .select({ totalValue: sql<string | null>`SUM(CAST(${conversionEvents.value} AS REAL))` })
        .from(conversionEvents)
        .where(conversionCondition)
        .all();

      const topEventsRaw = db.all<{ event_name: string; count: number }>(
        sql`SELECT ${conversionEvents.eventName} as event_name, COUNT(*) as count
            FROM conversion_events
            WHERE ${conversionCondition}
            GROUP BY ${conversionEvents.eventName}
            ORDER BY count DESC
            LIMIT 5`
      );

      return {
        short_id: shortId,
        total_scans: totalScans,
        period,
        scans_by_day: scansByDay,
        top_devices: topDevices,
        top_browsers: topBrowsers,
        top_countries: topCountries,
        top_referers: topReferers,
        recent_scans: recentScans.map((s) => ({
          scanned_at: s.scannedAt,
          user_agent: s.userAgent,
          referer: s.referer,
          device_type: s.deviceType,
          browser: s.browser,
          os: s.os,
          country: s.country,
          city: s.city,
        })),
        conversions: {
          total: totalConversions,
          total_value: totalValue ? parseFloat(totalValue) : 0,
          top_events: topEventsRaw,
        },
      };
    }
  );
}
