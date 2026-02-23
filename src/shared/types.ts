/** Supported QR code output formats */
export type QrFormat = "svg" | "png";

/** Standard paginated list response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
}
