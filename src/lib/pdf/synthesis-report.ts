import "server-only";

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

import type {
  EmergentTheme,
  Tension,
  TensionSide,
} from "@/lib/schemas/synthesis";
import type { ExportBranding } from "@/lib/settings/branding-assets";
import { translate } from "@/i18n/messages";
import { type Locale, toBcp47 } from "@/i18n/locale";

/**
 * "Research Synthesis" PDF — a forwardable read-out of a Stage-2 study
 * synthesis. Same Klymeo style as the Post-Loss Interview Report: white,
 * calm typography, violet #4A51A8 used sparingly as an accent.
 *
 * Typeface: Geist (brand font) is embedded as TrueType so German umlauts
 * (ü ö ä ß …) render reliably and on-brand. Falls back to Helvetica
 * (which also renders WinAnsi umlauts) if the font files can't be read,
 * so export never breaks. Repeatable blocks (themes, tensions) are
 * measured before drawing so they never split awkwardly across a page.
 *
 * STRICTLY ADDITIVE — this file does NOT import from or modify
 * interview-report.ts / solution-report.ts / generator.ts. They run
 * unchanged.
 */

const COLORS = {
  violet: "#4A51A8", // Klymeo accent — used sparingly
  violetSoft: "#ededf6", // light violet for small chips
  ink: "#18181b", // headings + key content
  body: "#3f3f46", // softer paragraph text
  muted: "#71717a", // captions, labels
  faint: "#9b9ba3", // quotes, footer
  border: "#e4e4e7",
  panel: "#f7f7f8", // soft neutral panel
  white: "#ffffff",
} as const;

interface Fonts {
  regular: string;
  bold: string;
  italic: string;
}

export interface SynthesisPdfInput {
  plan: {
    title: string;
    objective: string;
    persona: string | null;
  };
  synthesis: {
    overview: string | null;
    emergent_themes: EmergentTheme[];
    tensions: Tension[];
    based_on_count: number;
    /** ISO timestamp. Caller guarantees non-null (the API route 404s when
     *  synthesized_at is null — the PDF layer never sees an unsynthesized
     *  row). */
    synthesized_at: string;
    model: string | null;
  };
  orgName: string;
  /** Resolved UI locale (from the request cookie, via the route handler).
   *  Drives every chrome string + date formatting. */
  locale: Locale;
  /** Optional white-label branding (brand name / accent / embedded logo).
   *  When unset, falls back to today's exact "Klymeo" + violet #4A51A8. */
  branding?: ExportBranding;
}

// ── formatting helpers ──────────────────────────────────────────────────────

function formatDate(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(toBcp47(locale), {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
  const flat = cleanText(text);
  return flat.length > max ? `${flat.slice(0, max - 1)}...` : flat;
}

// ── pdfkit helpers (file-local — DO NOT cross-import from other pdf files) ──

/**
 * Embed Geist (brand font) for crisp, on-brand umlauts. Falls back to the
 * built-in Helvetica (which also renders WinAnsi umlauts) if the files are
 * missing, so PDF export never fails on a packaging issue. Mirrors the
 * pattern in interview-report.ts; the fallback path makes vercel-build
 * resilient to missing fs assets.
 */
function registerFonts(doc: PDFKit.PDFDocument): Fonts {
  const dir = path.join(process.cwd(), "src", "lib", "pdf", "fonts");
  try {
    doc.registerFont("Body", fs.readFileSync(path.join(dir, "Geist-Regular.ttf")));
    doc.registerFont("Body-Bold", fs.readFileSync(path.join(dir, "Geist-Bold.ttf")));
    doc.registerFont(
      "Body-Italic",
      fs.readFileSync(path.join(dir, "Geist-Italic.ttf")),
    );
    return { regular: "Body", bold: "Body-Bold", italic: "Body-Italic" };
  } catch (err) {
    console.warn(
      "[synthesis-pdf] Geist fonts unavailable; falling back to Helvetica:",
      err instanceof Error ? err.message : err,
    );
    return {
      regular: "Helvetica",
      bold: "Helvetica-Bold",
      italic: "Helvetica-Oblique",
    };
  }
}

function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

/** Add a page if fewer than `needed` points remain before the bottom margin.
 *  -28 leaves room for the page footer that's drawn in a second pass after
 *  every page has been laid out. */
function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 28;
  if (doc.y + needed > bottomLimit) doc.addPage();
}

/** Calm section heading: ink title with a short violet underline accent. */
function sectionHeading(
  doc: PDFKit.PDFDocument,
  title: string,
  boldFont: string,
): void {
  const left = doc.page.margins.left;
  ensureSpace(doc, 46);
  doc.moveDown(1.1);
  const y = doc.y;
  doc
    .font(boldFont)
    .fontSize(13)
    .fillColor(COLORS.ink)
    .text(title, left, y, { lineBreak: false });
  doc.rect(left, y + 18, 26, 2).fill(COLORS.violet);
  doc.y = y + 30;
}

/** Small violet chip used for theme-frequency badges ("4 Interviews"). */
function violetChip(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  boldFont: string,
): number {
  doc.font(boldFont).fontSize(8.5);
  const padX = 7;
  const padY = 4;
  const textW = doc.widthOfString(text);
  const chipW = textW + padX * 2;
  const chipH = 16;
  doc.roundedRect(x, y, chipW, chipH, 8).fill(COLORS.violetSoft);
  doc
    .fillColor(COLORS.violet)
    .text(text, x + padX, y + padY, {
      width: textW + 2,
      lineBreak: false,
    });
  return chipW;
}

/** Italic quote line with a 3-pt violet accent bar on the left. */
function quoteLine(
  doc: PDFKit.PDFDocument,
  quote: string,
  italicFont: string,
): void {
  const left = doc.page.margins.left;
  const indent = 14;
  const width = contentWidth(doc) - indent;
  doc.font(italicFont).fontSize(10);
  const formatted = `„${cleanText(quote)}"`;
  const qh = doc.heightOfString(formatted, { width });
  ensureSpace(doc, qh + 6);
  const qy = doc.y;
  doc.roundedRect(left, qy, 3, qh, 1.5).fill(COLORS.violet);
  doc
    .font(italicFont)
    .fontSize(10)
    .fillColor(COLORS.body)
    .text(formatted, left + indent, qy, { width, lineGap: 1 });
  doc.y = qy + qh + 4;
}

// ── builder ─────────────────────────────────────────────────────────────────

export async function buildSynthesisPdf(
  input: SynthesisPdfInput,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 46, bufferPages: true });
  const fonts = registerFonts(doc);

  // Geist OpenType ligatures (ff, fi, tt) break copy/paste & search in the
  // PDF text layer because pdfkit's font subset maps ligature glyphs without
  // a clean ToUnicode mapping. Disable OpenType features doc-wide so every
  // glyph keeps its own mapping — umlauts are precomposed glyphs and are
  // unaffected. Same workaround as interview-report.ts.
  const rawText = doc.text.bind(doc);
  function patchedText(...args: unknown[]) {
    const last = args[args.length - 1];
    let opts: Record<string, unknown>;
    if (last !== null && typeof last === "object") {
      opts = last as Record<string, unknown>;
    } else {
      opts = {};
      args.push(opts);
    }
    if (!("features" in opts)) {
      opts.features = {
        liga: false,
        clig: false,
        dlig: false,
        rlig: false,
        calt: false,
      };
    }
    return (rawText as (...a: unknown[]) => unknown)(...args);
  }
  (doc as unknown as { text: unknown }).text = patchedText;

  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const { plan, synthesis, orgName, locale } = input;

  // White-label brand mark + accent — fall back to today's exact "Klymeo" +
  // violet #4A51A8 when branding is unset.
  const brandName = input.branding?.brandName || "Klymeo";
  const accent = input.branding?.accentColorHex || COLORS.violet;

  // ── Header ──
  const topY = doc.y;
  let brandRendered = false;
  if (input.branding?.logo) {
    try {
      // Embed the customer logo INSTEAD of the brand text. height: 18 mirrors
      // the brand-text cap height so the date line on the right still aligns.
      doc.image(input.branding.logo.buffer, left, topY, { height: 18 });
      brandRendered = true;
    } catch (err) {
      console.warn(
        "[synthesis-pdf] logo embed failed; falling back to brand text:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  if (!brandRendered) {
    doc
      .font(fonts.bold)
      .fontSize(13)
      .fillColor(accent)
      .text(brandName, left, topY, { lineBreak: false });
  }
  doc
    .font(fonts.regular)
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(
      translate(locale, "export.synthesis.generatedOn", {
        date: formatDate(synthesis.synthesized_at, locale),
      }),
      left,
      topY + 2,
      {
        width,
        align: "right",
        lineBreak: false,
      },
    );
  doc.y = topY + 26;
  doc
    .font(fonts.bold)
    .fontSize(23)
    .fillColor(COLORS.ink)
    .text(translate(locale, "export.synthesis.title"), left, doc.y);
  doc.moveDown(0.2);
  doc
    .font(fonts.regular)
    .fontSize(11)
    .fillColor(COLORS.muted)
    .text(plan.title, left, doc.y, { width });
  doc.moveDown(0.5);
  doc.rect(left, doc.y, 64, 2.5).fill(accent);
  doc.y += 22;

  // Subtitle band — "Based on N interviews · synthesized DATE · org"
  const interviewsLabel =
    synthesis.based_on_count === 1
      ? translate(locale, "export.synthesis.interviewsOne")
      : translate(locale, "export.synthesis.interviewsMany", {
          n: synthesis.based_on_count,
        });
  doc
    .font(fonts.regular)
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(
      translate(locale, "export.synthesis.subtitleLine", {
        interviews: interviewsLabel,
        date: formatDate(synthesis.synthesized_at, locale),
        org: orgName,
      }),
      left,
      doc.y,
      { width },
    );
  doc.moveDown(0.6);

  // ── Plan context panel (objective + optional persona) ──
  const planRows: Array<[string, string]> = [
    [translate(locale, "export.synthesis.objective"), truncate(plan.objective, 220)],
  ];
  if (plan.persona && plan.persona.trim() !== "") {
    planRows.push([
      translate(locale, "export.synthesis.persona"),
      truncate(plan.persona, 220),
    ]);
  }
  const boxH = 34 + planRows.length * 22 + 6;
  const bandY = doc.y;
  doc.roundedRect(left, bandY, width, boxH, 8).fill(COLORS.panel);
  doc
    .font(fonts.bold)
    .fontSize(9)
    .fillColor(COLORS.violet)
    .text(translate(locale, "export.synthesis.study"), left + 14, bandY + 14, {
      width: width - 28,
      lineBreak: false,
    });
  let cy = bandY + 34;
  for (const [k, v] of planRows) {
    doc
      .font(fonts.regular)
      .fontSize(9.5)
      .fillColor(COLORS.muted)
      .text(k, left + 14, cy, { width: 70, lineBreak: false });
    doc
      .font(fonts.regular)
      .fontSize(9.5)
      .fillColor(COLORS.ink)
      .text(v, left + 90, cy, { width: width - 104 });
    cy = doc.y + 6;
  }
  doc.y = Math.max(bandY + boxH, cy);

  // ── Overview ──
  sectionHeading(doc, translate(locale, "export.synthesis.overview"), fonts.bold);
  if (synthesis.overview && synthesis.overview.trim() !== "") {
    doc
      .font(fonts.regular)
      .fontSize(10.5)
      .fillColor(COLORS.body)
      .text(cleanText(synthesis.overview), left, doc.y, { width, lineGap: 1.5 });
  } else {
    doc
      .font(fonts.italic)
      .fontSize(10.5)
      .fillColor(COLORS.muted)
      .text(translate(locale, "export.synthesis.overviewEmpty"), left, doc.y, {
        width,
      });
  }
  doc.moveDown(0.6);

  // ── Emergent themes ──
  sectionHeading(
    doc,
    translate(locale, "export.synthesis.themesHeading", {
      count: synthesis.emergent_themes.length,
    }),
    fonts.bold,
  );
  if (synthesis.emergent_themes.length === 0) {
    doc
      .font(fonts.italic)
      .fontSize(10.5)
      .fillColor(COLORS.muted)
      .text(
        translate(locale, "export.synthesis.themesEmpty"),
        left,
        doc.y,
        { width },
      );
    doc.moveDown(0.4);
  } else {
    for (const theme of synthesis.emergent_themes) {
      renderTheme(doc, theme, fonts, synthesis.based_on_count, locale);
    }
  }

  // ── Tensions ──
  sectionHeading(
    doc,
    translate(locale, "export.synthesis.tensionsHeading", {
      count: synthesis.tensions.length,
    }),
    fonts.bold,
  );
  if (synthesis.tensions.length === 0) {
    doc
      .font(fonts.italic)
      .fontSize(10.5)
      .fillColor(COLORS.muted)
      .text(
        translate(locale, "export.synthesis.tensionsEmpty"),
        left,
        doc.y,
        { width },
      );
    doc.moveDown(0.4);
  } else {
    for (const tension of synthesis.tensions) {
      renderTension(doc, tension, fonts, locale);
    }
  }

  // Optional: model footnote, dezent, am Ende des Content-Streams.
  if (synthesis.model) {
    ensureSpace(doc, 24);
    doc.moveDown(0.8);
    doc
      .font(fonts.regular)
      .fontSize(8)
      .fillColor(COLORS.faint)
      .text(
        translate(locale, "export.synthesis.modelFootnote", {
          model: synthesis.model,
        }),
        left,
        doc.y,
        { width },
      );
  }

  // ── Footer on every page (buffered) ──
  // Zero each page's bottom margin before writing in the footer band so
  // pdfkit doesn't treat the position as overflow and add a blank page —
  // same workaround as interview-report.ts.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0;
    const fy = doc.page.height - 34;
    doc
      .font(fonts.regular)
      .fontSize(8)
      .fillColor(COLORS.faint)
      .text(translate(locale, "export.synthesis.confidentialFooter"), left, fy, {
        width,
        align: "left",
        lineBreak: false,
      });
    doc.text(
      translate(locale, "export.synthesis.pageXOfY", {
        page: i + 1,
        total: range.count,
      }),
      left,
      fy,
      {
        width,
        align: "right",
        lineBreak: false,
      },
    );
  }

  return pdfToBuffer(doc);
}

// ── per-block renderers ─────────────────────────────────────────────────────

function renderTheme(
  doc: PDFKit.PDFDocument,
  theme: EmergentTheme,
  fonts: Fonts,
  totalParticipants: number,
  locale: Locale,
): void {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);

  // Pre-measure roughly: title + summary + up to 3 quotes. Keep at least the
  // title with its first quote on the same page so a theme never opens
  // alone at the bottom of a page.
  doc.font(fonts.bold).fontSize(12);
  const titleH = doc.heightOfString(theme.title, { width });
  ensureSpace(doc, titleH + 60);

  const startY = doc.y;
  doc.font(fonts.bold).fontSize(12).fillColor(COLORS.ink).text(theme.title, left, startY, {
    width: width - 130, // leave room for the freq chip on the right
  });
  const afterTitleY = doc.y;

  // Frequency chip on the right of the title row.
  const chipText =
    theme.frequency === 1
      ? translate(locale, "export.synthesis.interviewsOne")
      : translate(locale, "export.synthesis.freqOfTotal", {
          freq: theme.frequency,
          total: totalParticipants,
        });
  const chipY = startY + 1;
  doc.font(fonts.bold).fontSize(8.5);
  const chipW =
    doc.widthOfString(chipText) + 14; // approximate chip width incl. padding
  violetChip(doc, chipText, left + width - chipW, chipY, fonts.bold);

  doc.y = afterTitleY + 4;

  // Summary paragraph.
  doc
    .font(fonts.regular)
    .fontSize(10.5)
    .fillColor(COLORS.body)
    .text(cleanText(theme.summary), left, doc.y, { width, lineGap: 1 });
  doc.moveDown(0.4);

  // Up to 3 quotes (more get truncated to keep the PDF readable; the
  // dashboard shows the full list).
  const quotes = theme.quotes.slice(0, 3);
  for (const q of quotes) {
    quoteLine(doc, q, fonts.italic);
  }
  if (theme.quotes.length > quotes.length) {
    doc
      .font(fonts.regular)
      .fontSize(8.5)
      .fillColor(COLORS.faint)
      .text(
        translate(locale, "export.synthesis.moreQuotesInDashboard", {
          count: theme.quotes.length - quotes.length,
        }),
        left + 14,
        doc.y,
        { width: width - 14 },
      );
    doc.moveDown(0.2);
  }
  doc.moveDown(0.6);
}

function renderTension(
  doc: PDFKit.PDFDocument,
  tension: Tension,
  fonts: Fonts,
  locale: Locale,
): void {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);

  // Pre-reserve for the description + both side labels (quotes will flow
  // naturally onto subsequent pages if needed).
  doc.font(fonts.bold).fontSize(11);
  const descH = doc.heightOfString(tension.description, { width });
  ensureSpace(doc, descH + 80);

  doc
    .font(fonts.bold)
    .fontSize(11)
    .fillColor(COLORS.ink)
    .text(cleanText(tension.description), left, doc.y, { width, lineGap: 1 });
  doc.moveDown(0.5);

  renderTensionSide(
    doc,
    tension.side_a,
    translate(locale, "export.synthesis.sideA"),
    fonts,
    locale,
  );
  renderTensionSide(
    doc,
    tension.side_b,
    translate(locale, "export.synthesis.sideB"),
    fonts,
    locale,
  );
  doc.moveDown(0.4);
}

function renderTensionSide(
  doc: PDFKit.PDFDocument,
  side: TensionSide,
  sideName: string,
  fonts: Fonts,
  locale: Locale,
): void {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);

  // Side-name caption (small caps style — done via uppercase + tracking).
  ensureSpace(doc, 36);
  doc
    .font(fonts.bold)
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(sideName.toUpperCase(), left, doc.y, { width, lineBreak: false });
  doc.moveDown(0.15);

  // Side label — the actual position name.
  doc
    .font(fonts.bold)
    .fontSize(11)
    .fillColor(COLORS.ink)
    .text(cleanText(side.label), left, doc.y, { width });
  doc.moveDown(0.25);

  // Source-count footnote in mono-style caption.
  const srcLabel =
    side.sourceInsightIds.length === 1
      ? translate(locale, "export.synthesis.sourceOne")
      : translate(locale, "export.synthesis.sourceMany", {
          n: side.sourceInsightIds.length,
        });
  doc
    .font(fonts.regular)
    .fontSize(8.5)
    .fillColor(COLORS.faint)
    .text(srcLabel, left, doc.y, { width });
  doc.moveDown(0.25);

  // Up to 3 quotes, same accent bar as themes.
  const quotes = side.quotes.slice(0, 3);
  for (const q of quotes) {
    quoteLine(doc, q, fonts.italic);
  }
  if (side.quotes.length > quotes.length) {
    doc
      .font(fonts.regular)
      .fontSize(8.5)
      .fillColor(COLORS.faint)
      .text(
        translate(locale, "export.synthesis.moreQuotesInDashboard", {
          count: side.quotes.length - quotes.length,
        }),
        left + 14,
        doc.y,
        { width: width - 14 },
      );
    doc.moveDown(0.2);
  }
  doc.moveDown(0.5);
}
