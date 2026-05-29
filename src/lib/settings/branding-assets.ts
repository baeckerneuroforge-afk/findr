import "server-only";

import { getOrgBranding } from "./org-settings";

/**
 * Branding asset helpers for the white-label EXPORT surface (PDF/PPTX).
 *
 * pdfkit and pptxgenjs need raster BYTES, not a remote URL — so a customer
 * logo stored as a public URL must be fetched + embedded here. The interview
 * page (an <img src>) and the HTML email (an <img>) use the URL directly and
 * don't go through this module.
 */

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** The default Findr accent used across the interview / export / mail surfaces. */
export const DEFAULT_ACCENT = "#5B2FD4";

/**
 * Return `value` only if it is a valid #RRGGBB hex string, else `fallback`.
 * Defense-in-depth against a non-hex string reaching a CSS/HTML/PDF color slot
 * (the DB CHECK already enforces this on write, but reads and older rows are
 * validated here too).
 */
export function safeHexColor(
  value: string | null | undefined,
  fallback: string = DEFAULT_ACCENT,
): string {
  return value && HEX_COLOR.test(value) ? value : fallback;
}

// pdfkit/pptxgenjs raster only — svg (allowed on upload) is skipped here so a
// vector logo simply falls back to the text brand name in exports.
const RASTER_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export interface FetchedLogo {
  /** Raw bytes — for pdfkit doc.image(buffer, …). */
  buffer: Buffer;
  /** data:<mime>;base64,… — for pptxgenjs addImage({ data }). */
  dataUrl: string;
  contentType: string;
}

/** Branding payload passed into the export generators. */
export interface ExportBranding {
  /** Brand name shown instead of "Findr" in headers/footers. Null = "Findr". */
  brandName: string | null;
  /** Always a valid #RRGGBB (safe-hex'd, default accent when unset). */
  accentColorHex: string;
  /** Embeddable logo bytes, or null → fall back to the text brand name. */
  logo: FetchedLogo | null;
}

/**
 * Fetch an org logo from its public URL for embedding in a PDF/PPTX. Returns
 * null (→ caller falls back to the text brand name) on any problem: missing
 * URL, non-raster type (e.g. svg), oversize, or fetch error. NEVER throws.
 */
export async function fetchOrgLogo(
  logoUrl: string | null,
): Promise<FetchedLogo | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!RASTER_LOGO_TYPES.has(contentType)) return null;
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_LOGO_BYTES) {
      return null;
    }
    const buffer = Buffer.from(arrayBuffer);
    return {
      buffer,
      dataUrl: `data:${contentType};base64,${buffer.toString("base64")}`,
      contentType,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve the full export-branding payload for an org in one call: branding
 * row → safe accent → embedded logo bytes. Used by the export API routes
 * before invoking a generator. Never throws (logo failures degrade to text).
 */
export async function resolveExportBranding(
  orgId: string,
): Promise<ExportBranding> {
  const branding = await getOrgBranding(orgId);
  return {
    brandName: branding.brandName,
    accentColorHex: safeHexColor(branding.accentColor),
    logo: await fetchOrgLogo(branding.logoUrl),
  };
}
