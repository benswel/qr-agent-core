/** Supported QR code output formats */
export type QrFormat = "svg" | "png";

/** Style options for custom QR code rendering */
export interface QrStyleOptions {
  foreground_color?: string;
  background_color?: string;
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

/** Augment Fastify request with apiKeyId for multi-tenant scoping */
declare module "fastify" {
  interface FastifyRequest {
    apiKeyId: number;
  }
}
