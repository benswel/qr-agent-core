import dns from "node:dns/promises";

export type DnsStatus = "active" | "pending";

/**
 * Check if a domain resolves via DNS (CNAME or A record).
 * Returns "active" if it resolves, "pending" if it does not.
 */
export async function checkDnsStatus(domain: string): Promise<DnsStatus> {
  try {
    await dns.resolveCname(domain);
    return "active";
  } catch {
    // Fall through to A record check
  }

  try {
    await dns.resolve4(domain);
    return "active";
  } catch {
    return "pending";
  }
}
