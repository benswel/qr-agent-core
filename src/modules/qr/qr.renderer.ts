import QRCode from "qrcode";
import type { QrFormat } from "../../shared/types.js";

/**
 * Renders a QR code image for the given content.
 *
 * @param content - The string to encode (typically a short URL)
 * @param format - Output format: "svg" returns raw XML, "png" returns base64
 * @returns The rendered QR code as a string
 */
export async function renderQrCode(
  content: string,
  format: QrFormat
): Promise<string> {
  const options = {
    errorCorrectionLevel: "M" as const,
    margin: 2,
    width: 400,
  };

  if (format === "svg") {
    return QRCode.toString(content, { ...options, type: "svg" });
  }

  // PNG: return as base64 string (without data URI prefix — agents can add it if needed)
  return QRCode.toDataURL(content, { ...options, type: "image/png" });
}
