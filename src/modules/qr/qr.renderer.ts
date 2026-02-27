import QRCode from "qrcode";
import sharp from "sharp";
import type { QrFormat, QrStyleOptions } from "../../shared/types.js";

const DEFAULT_WIDTH = 400;
const DEFAULT_MARGIN = 2;
const DEFAULT_FOREGROUND = "#000000";
const DEFAULT_BACKGROUND = "#ffffff";
const DEFAULT_ERROR_CORRECTION = "M";
const DEFAULT_LOGO_SIZE = 0.2;

interface QrMatrix {
  modules: boolean[][];
  size: number;
}

/**
 * Extract the QR code module matrix from qrcode library.
 */
function getQrMatrix(content: string, errorCorrectionLevel: string): QrMatrix {
  const qr = QRCode.create(content, {
    errorCorrectionLevel: errorCorrectionLevel as "L" | "M" | "Q" | "H",
  });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const modules: boolean[][] = [];

  for (let row = 0; row < size; row++) {
    modules[row] = [];
    for (let col = 0; col < size; col++) {
      modules[row][col] = !!data[row * size + col];
    }
  }

  return { modules, size };
}

/**
 * Check if a module position is part of a finder pattern (the 3 big corner squares).
 */
function isFinderPattern(row: number, col: number, size: number): boolean {
  // Top-left finder pattern: rows 0-6, cols 0-6
  if (row <= 6 && col <= 6) return true;
  // Top-right finder pattern: rows 0-6, cols (size-7) to (size-1)
  if (row <= 6 && col >= size - 7) return true;
  // Bottom-left finder pattern: rows (size-7) to (size-1), cols 0-6
  if (row >= size - 7 && col <= 6) return true;
  return false;
}

// --- Dot renderers ---

function renderSquareDot(x: number, y: number, s: number): string {
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`;
}

function renderRoundedDot(x: number, y: number, s: number): string {
  const r = s * 0.3;
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}" ry="${r}"/>`;
}

function renderCircleDot(x: number, y: number, s: number): string {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const r = s * 0.45;
  return `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
}

function renderClassyRoundedDot(x: number, y: number, s: number): string {
  const r = s * 0.4;
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}" ry="${r}"/>`;
}

type DotRenderer = (x: number, y: number, s: number) => string;

function getDotRenderer(style: string): DotRenderer {
  switch (style) {
    case "rounded":
      return renderRoundedDot;
    case "dots":
      return renderCircleDot;
    case "classy-rounded":
      return renderClassyRoundedDot;
    default:
      return renderSquareDot;
  }
}

// --- Corner (finder pattern) renderers ---

function renderFinderPatternSquare(
  x: number,
  y: number,
  moduleSize: number,
  fg: string,
  bg: string
): string {
  const s = moduleSize * 7;
  const innerOuter = moduleSize;
  const innerSize = moduleSize * 3;
  return [
    `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${fg}"/>`,
    `<rect x="${x + innerOuter}" y="${y + innerOuter}" width="${s - innerOuter * 2}" height="${s - innerOuter * 2}" fill="${bg}"/>`,
    `<rect x="${x + innerOuter * 2}" y="${y + innerOuter * 2}" width="${innerSize}" height="${innerSize}" fill="${fg}"/>`,
  ].join("");
}

function renderFinderPatternExtraRounded(
  x: number,
  y: number,
  moduleSize: number,
  fg: string,
  bg: string
): string {
  const s = moduleSize * 7;
  const outerR = moduleSize * 2;
  const innerOuter = moduleSize;
  const midS = s - innerOuter * 2;
  const midR = moduleSize * 1.2;
  const innerSize = moduleSize * 3;
  const innerR = moduleSize * 0.8;
  return [
    `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${outerR}" ry="${outerR}" fill="${fg}"/>`,
    `<rect x="${x + innerOuter}" y="${y + innerOuter}" width="${midS}" height="${midS}" rx="${midR}" ry="${midR}" fill="${bg}"/>`,
    `<rect x="${x + innerOuter * 2}" y="${y + innerOuter * 2}" width="${innerSize}" height="${innerSize}" rx="${innerR}" ry="${innerR}" fill="${fg}"/>`,
  ].join("");
}

function renderFinderPatternDot(
  x: number,
  y: number,
  moduleSize: number,
  fg: string,
  bg: string
): string {
  const s = moduleSize * 7;
  const cx = x + s / 2;
  const cy = y + s / 2;
  const outerR = s / 2;
  const midR = (s - moduleSize * 2) / 2;
  const innerR = (moduleSize * 3) / 2;
  return [
    `<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="${fg}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${midR}" fill="${bg}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="${fg}"/>`,
  ].join("");
}

type FinderRenderer = (
  x: number,
  y: number,
  moduleSize: number,
  fg: string,
  bg: string
) => string;

function getFinderRenderer(style: string): FinderRenderer {
  switch (style) {
    case "extra-rounded":
      return renderFinderPatternExtraRounded;
    case "dot":
      return renderFinderPatternDot;
    default:
      return renderFinderPatternSquare;
  }
}

/**
 * Build the complete SVG string from a QR matrix and style options.
 */
function buildSvg(
  matrix: QrMatrix,
  options: Required<
    Pick<
      QrStyleOptions,
      | "foreground_color"
      | "background_color"
      | "width"
      | "margin"
      | "dot_style"
      | "corner_style"
    >
  >,
  logoDataUri?: string,
  logoSizeRatio?: number
): string {
  const { modules, size } = matrix;
  const totalModules = size + options.margin * 2;
  const moduleSize = options.width / totalModules;
  const offset = options.margin * moduleSize;

  const fg = options.foreground_color;
  const bg = options.background_color;

  const dotRenderer = getDotRenderer(options.dot_style);
  const finderRenderer = getFinderRenderer(options.corner_style);

  const parts: string[] = [];

  // SVG header
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${options.width} ${options.width}" width="${options.width}" height="${options.width}">`
  );

  // Background
  parts.push(
    `<rect x="0" y="0" width="${options.width}" height="${options.width}" fill="${bg}"/>`
  );

  // Render finder patterns
  // Top-left
  parts.push(finderRenderer(offset, offset, moduleSize, fg, bg));
  // Top-right
  parts.push(
    finderRenderer(offset + (size - 7) * moduleSize, offset, moduleSize, fg, bg)
  );
  // Bottom-left
  parts.push(
    finderRenderer(offset, offset + (size - 7) * moduleSize, moduleSize, fg, bg)
  );

  // Render data dots (skip finder patterns)
  parts.push(`<g fill="${fg}">`);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!modules[row][col]) continue;
      if (isFinderPattern(row, col, size)) continue;

      const x = offset + col * moduleSize;
      const y = offset + row * moduleSize;
      parts.push(dotRenderer(x, y, moduleSize));
    }
  }
  parts.push("</g>");

  // Render logo overlay
  if (logoDataUri && logoSizeRatio) {
    const logoSize = options.width * logoSizeRatio;
    const logoX = (options.width - logoSize) / 2;
    const logoY = (options.width - logoSize) / 2;
    // White background behind logo for readability
    const padding = logoSize * 0.1;
    parts.push(
      `<rect x="${logoX - padding}" y="${logoY - padding}" width="${logoSize + padding * 2}" height="${logoSize + padding * 2}" fill="${bg}" rx="${padding}"/>`
    );
    parts.push(
      `<image x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" href="${logoDataUri}" preserveAspectRatio="xMidYMid meet"/>`
    );
  }

  parts.push("</svg>");
  return parts.join("\n");
}

/**
 * Download a logo from URL or parse a data URI, resize it, and return as a data URI.
 */
async function fetchLogo(
  logoUrl: string,
  targetSize: number
): Promise<string> {
  let buffer: Buffer;

  if (logoUrl.startsWith("data:")) {
    // Parse data URI
    const matches = logoUrl.match(/^data:[^;]+;base64,(.+)$/);
    if (!matches) throw new Error("Invalid data URI for logo");
    buffer = Buffer.from(matches[1], "base64");
  } else {
    // Download from URL
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(logoUrl, { signal: controller.signal });
      if (!res.ok) throw new Error(`Logo download failed: ${res.status}`);
      buffer = Buffer.from(await res.arrayBuffer());
    } finally {
      clearTimeout(timeout);
    }
  }

  // Resize with sharp and convert to PNG
  const resized = await sharp(buffer)
    .resize(Math.round(targetSize), Math.round(targetSize), {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return `data:image/png;base64,${resized.toString("base64")}`;
}

/**
 * Renders a QR code image for the given content.
 *
 * @param content - The string to encode (typically a short URL)
 * @param format - Output format: "svg" returns raw XML, "png" returns base64
 * @param style - Optional styling options
 * @returns The rendered QR code as a string
 */
export async function renderQrCode(
  content: string,
  format: QrFormat,
  style?: QrStyleOptions
): Promise<string> {
  const fg = style?.foreground_color || DEFAULT_FOREGROUND;
  const bg = style?.background_color || DEFAULT_BACKGROUND;
  const width = style?.width || DEFAULT_WIDTH;
  const margin = style?.margin ?? DEFAULT_MARGIN;
  const dotStyle = style?.dot_style || "square";
  const cornerStyle = style?.corner_style || "square";
  const logoUrl = style?.logo_url;
  const logoSize = style?.logo_size || DEFAULT_LOGO_SIZE;

  // Auto-bump to H error correction when logo is present
  const errorCorrection =
    logoUrl && (!style?.error_correction || style.error_correction === "L" || style.error_correction === "M")
      ? "H"
      : style?.error_correction || DEFAULT_ERROR_CORRECTION;

  const matrix = getQrMatrix(content, errorCorrection);

  // Fetch and resize logo if provided
  let logoDataUri: string | undefined;
  if (logoUrl) {
    const logoPixelSize = width * logoSize;
    logoDataUri = await fetchLogo(logoUrl, logoPixelSize);
  }

  const svgString = buildSvg(
    matrix,
    {
      foreground_color: fg,
      background_color: bg,
      width,
      margin,
      dot_style: dotStyle,
      corner_style: cornerStyle,
    },
    logoDataUri,
    logoUrl ? logoSize : undefined
  );

  if (format === "svg") {
    return svgString;
  }

  // PNG: convert SVG to PNG using sharp
  const pngBuffer = await sharp(Buffer.from(svgString))
    .resize(width, width)
    .png()
    .toBuffer();

  return `data:image/png;base64,${pngBuffer.toString("base64")}`;
}
