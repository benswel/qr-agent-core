import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";
import type { UtmParams, RedirectRule, TimeRangeValue, AbSplitValue } from "../../shared/types.js";

/** Pre-parsed request data, used for both rule evaluation and scan recording */
export interface ParsedRequest {
  deviceType: string;     // "mobile" | "tablet" | "desktop"
  browser: string | null;
  os: string | null;
  country: string | null;
  city: string | null;
  language: string | null; // primary language from Accept-Language (e.g. "fr", "en")
}

/** Parse user-agent, IP, and Accept-Language into structured data */
export function parseRequest(ua?: string, ip?: string, acceptLanguage?: string): ParsedRequest {
  let deviceType = "desktop";
  let browser: string | null = null;
  let os: string | null = null;

  if (ua) {
    const parsed = (UAParser as unknown as (ua: string) => { device: { type?: string }; browser: { name?: string }; os: { name?: string } })(ua);
    deviceType = parsed.device.type || "desktop";
    browser = parsed.browser.name || null;
    os = parsed.os.name || null;
  }

  let country: string | null = null;
  let city: string | null = null;
  if (ip && ip !== "127.0.0.1") {
    const geo = geoip.lookup(ip);
    if (geo) {
      country = geo.country || null;
      city = geo.city || null;
    }
  }

  let language: string | null = null;
  if (acceptLanguage) {
    // Extract primary language: "fr-FR,fr;q=0.9,en;q=0.8" → "fr"
    const primary = acceptLanguage.split(",")[0]?.split("-")[0]?.split(";")[0]?.trim().toLowerCase();
    if (primary && primary.length >= 2) language = primary;
  }

  return { deviceType, browser, os, country, city, language };
}

/** Append UTM parameters to a URL */
export function applyUtmParams(targetUrl: string, utm: UtmParams): string {
  const url = new URL(targetUrl);
  if (utm.source) url.searchParams.set("utm_source", utm.source);
  if (utm.medium) url.searchParams.set("utm_medium", utm.medium);
  if (utm.campaign) url.searchParams.set("utm_campaign", utm.campaign);
  if (utm.term) url.searchParams.set("utm_term", utm.term);
  if (utm.content) url.searchParams.set("utm_content", utm.content);
  return url.toString();
}

/** Evaluate a single condition against parsed request data */
function evaluateCondition(cond: { type: string; value: unknown }, parsed: ParsedRequest): boolean {
  switch (cond.type) {
    case "device":
      return parsed.deviceType === cond.value;
    case "os":
      return (parsed.os?.toLowerCase() ?? "") === (cond.value as string).toLowerCase();
    case "country":
      return parsed.country === (cond.value as string).toUpperCase();
    case "language":
      return parsed.language === (cond.value as string).toLowerCase();
    case "time_range": {
      const { start, end, timezone } = cond.value as TimeRangeValue;
      try {
        const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
        return now >= start && now <= end;
      } catch {
        return false;
      }
    }
    case "ab_split": {
      const { percentage } = cond.value as AbSplitValue;
      return Math.random() * 100 < percentage;
    }
    default:
      return false;
  }
}

/** Evaluate redirect rules top-to-bottom. All conditions in a rule must match (AND). Returns matching target_url or null. */
export function evaluateRules(rules: RedirectRule[], parsed: ParsedRequest): string | null {
  for (const rule of rules) {
    // Support both new "conditions" (array) and legacy "condition" (single object)
    const conditions: Array<{ type: string; value: unknown }> =
      rule.conditions ??
      ((rule as unknown as { condition?: { type: string; value: unknown } }).condition
        ? [(rule as unknown as { condition: { type: string; value: unknown } }).condition]
        : []);

    if (conditions.length === 0) continue;

    const allMatch = conditions.every(cond => evaluateCondition(cond, parsed));
    if (allMatch) return rule.target_url;
  }
  return null;
}

/** Escape a string for safe inclusion in HTML attributes */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Build an intermediate HTML page with GTM snippet that redirects to targetUrl */
export function buildGtmPage(targetUrl: string, gtmId: string): string {
  const safeUrl = escapeHtml(targetUrl);
  // JS-safe URL: escape backslashes and quotes for inline script
  const jsUrl = targetUrl.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Redirecting...</title>
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');</script>
<!-- End Google Tag Manager -->
<meta http-equiv="refresh" content="1;url=${safeUrl}">
</head>
<body>
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
<p>Redirecting...</p>
<script>setTimeout(function(){window.location.href="${jsUrl}"},1000);</script>
</body>
</html>`;
}
