import "server-only";

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

import type { MetaSynthesisResult } from "@/lib/schemas/meta-synthesis";
import type { ExportBranding } from "@/lib/settings/branding-assets";
import { translate } from "@/i18n/messages";
import { type Locale, toBcp47 } from "@/i18n/locale";

/**
 * "Meta-Synthesis" PDF — a forwardable read-out of a cross-study meta-synthesis.
 * Same Klymeo style as the single-study Synthesis Report (white, calm typography,
 * violet #4A51A8 accent), but the CONTENT is cross-study: an overview, convergent
 * themes (each quote ATTRIBUTED to its source study), divergences (positions
 * labelled by study), per-study contributions, and the non-evidenced
 * interpretation.
 *
 * STRICTLY ADDITIVE + SELF-CONTAINED — like synthesis-report.ts, this file does
 * NOT import from or modify the other pdf report files; the pdfkit helpers are
 * forked here (the established one-file-per-report pattern), so each report can
 * evolve independently.
 */

const COLORS = {
  violet: "#4A51A8",
  violetSoft: "#ededf6",
  ink: "#18181b",
  body: "#3f3f46",
  muted: "#71717a",
  faint: "#9b9ba3",
  border: "#e4e4e7",
  panel: "#f7f7f8",
  amber: "#854F0B", // divergence accent (matches the on-screen warning tone)
  white: "#ffffff",
} as const;

interface Fonts {
  regular: string;
  bold: string;
  italic: string;
}

/** One compared study — labels a citation's studyId + drives the header panel. */
export interface MetaSynthesisPdfStudy {
  studyId: string;
  studyTitle: string;
  basedOnCount: number;
}

export interface MetaSynthesisPdfInput {
  title: string;
  /** ISO timestamp of creation. */
  createdAt: string;
  model: string | null;
  totalStudies: number;
  totalInterviews: number;
  studies: MetaSynthesisPdfStudy[];
  result: MetaSynthesisResult;
  orgName: string;
  locale: Locale;
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

// ── pdfkit helpers (file-local — forked, DO NOT cross-import) ────────────────

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
      "[meta-synthesis-pdf] Geist fonts unavailable; falling back to Helvetica:",
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

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 28;
  if (doc.y + needed > bottomLimit) doc.addPage();
}

function sectionHeading(
  doc: PDFKit.PDFDocument,
  title: string,
  boldFont: string,
  accent: string,
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
  doc.rect(left, y + 18, 26, 2).fill(accent);
  doc.y = y + 30;
}

/** Small chip (theme study-frequency badge). */
function chip(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  boldFont: string,
  fill: string,
  fg: string,
): number {
  doc.font(boldFont).fontSize(8.5);
  const padX = 7;
  const padY = 4;
  const textW = doc.widthOfString(text);
  const chipW = textW + padX * 2;
  doc.roundedRect(x, y, chipW, 16, 8).fill(fill);
  doc.fillColor(fg).text(text, x + padX, y + padY, {
    width: textW + 2,
    lineBreak: false,
  });
  return chipW;
}

/** Italic quote with a violet accent bar + a small "— Studie" attribution. This
 *  per-study attribution is the whole point of the dedicated meta exporter. */
function attributedQuote(
  doc: PDFKit.PDFDocument,
  quote: string,
  studyLabel: string,
  fonts: Fonts,
): void {
  const left = doc.page.margins.left;
  const indent = 14;
  const width = contentWidth(doc) - indent;
  doc.font(fonts.italic).fontSize(10);
  const formatted = `„${cleanText(quote)}"`;
  const qh = doc.heightOfString(formatted, { width });
  ensureSpace(doc, qh + 18);
  const qy = doc.y;
  doc.roundedRect(left, qy, 3, qh, 1.5).fill(COLORS.violet);
  doc
    .font(fonts.italic)
    .fontSize(10)
    .fillColor(COLORS.body)
    .text(formatted, left + indent, qy, { width, lineGap: 1 });
  doc.y = qy + qh + 2;
  doc
    .font(fonts.bold)
    .fontSize(8)
    .fillColor(COLORS.violet)
    .text(`— ${cleanText(studyLabel)}`, left + indent, doc.y, { width });
  doc.moveDown(0.4);
}

// ── builder ─────────────────────────────────────────────────────────────────

export async function buildMetaSynthesisPdf(
  input: MetaSynthesisPdfInput,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 46, bufferPages: true });
  const fonts = registerFonts(doc);

  // Disable OpenType ligatures doc-wide (same workaround as synthesis-report.ts)
  // so copy/paste + search stay clean and umlauts render as precomposed glyphs.
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
      opts.features = { liga: false, clig: false, dlig: false, rlig: false, calt: false };
    }
    return (rawText as (...a: unknown[]) => unknown)(...args);
  }
  (doc as unknown as { text: unknown }).text = patchedText;

  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const { result, locale } = input;
  const L = "export.metaSynthesis";

  const brandName = input.branding?.brandName || "Klymeo";
  const accent = input.branding?.accentColorHex || COLORS.violet;

  const titleByStudy = new Map(
    input.studies.map((s) => [s.studyId, s.studyTitle]),
  );
  const resolveTitle = (studyId: string): string =>
    titleByStudy.get(studyId) ?? studyId;

  // ── Header ──
  const topY = doc.y;
  let brandRendered = false;
  if (input.branding?.logo) {
    try {
      doc.image(input.branding.logo.buffer, left, topY, { height: 18 });
      brandRendered = true;
    } catch (err) {
      console.warn(
        "[meta-synthesis-pdf] logo embed failed; falling back to brand text:",
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
      translate(locale, `${L}.generatedOn`, {
        date: formatDate(input.createdAt, locale),
      }),
      left,
      topY + 2,
      { width, align: "right", lineBreak: false },
    );
  doc.y = topY + 26;
  doc
    .font(fonts.bold)
    .fontSize(23)
    .fillColor(COLORS.ink)
    .text(translate(locale, `${L}.title`), left, doc.y);
  doc.moveDown(0.2);
  doc
    .font(fonts.regular)
    .fontSize(11)
    .fillColor(COLORS.muted)
    .text(cleanText(input.title), left, doc.y, { width });
  doc.moveDown(0.5);
  doc.rect(left, doc.y, 64, 2.5).fill(accent);
  doc.y += 22;

  doc
    .font(fonts.regular)
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(
      translate(locale, `${L}.subtitleLine`, {
        studies: input.totalStudies,
        interviews: input.totalInterviews,
        date: formatDate(input.createdAt, locale),
      }),
      left,
      doc.y,
      { width },
    );
  doc.moveDown(0.6);

  // ── Compared-studies panel ──
  if (input.studies.length > 0) {
    const rowH = 16;
    const boxH = 34 + input.studies.length * rowH + 6;
    const bandY = doc.y;
    ensureSpace(doc, boxH);
    doc.roundedRect(left, doc.y, width, boxH, 8).fill(COLORS.panel);
    doc
      .font(fonts.bold)
      .fontSize(9)
      .fillColor(accent)
      .text(translate(locale, `${L}.comparedStudies`), left + 14, bandY + 14, {
        width: width - 28,
        lineBreak: false,
      });
    let cy = bandY + 34;
    for (const s of input.studies) {
      doc
        .font(fonts.regular)
        .fontSize(9.5)
        .fillColor(COLORS.ink)
        .text(`• ${truncate(s.studyTitle, 90)}`, left + 14, cy, {
          width: width - 120,
          lineBreak: false,
        });
      doc
        .font(fonts.regular)
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(
          translate(locale, "export.synthesis.interviewsMany", {
            n: s.basedOnCount,
          }),
          left + width - 120,
          cy,
          { width: 106, align: "right", lineBreak: false },
        );
      cy += rowH;
    }
    doc.y = bandY + boxH;
  }

  // ── Overview ──
  sectionHeading(doc, translate(locale, `${L}.overview`), fonts.bold, accent);
  if (result.overview.trim() !== "") {
    doc
      .font(fonts.regular)
      .fontSize(10.5)
      .fillColor(COLORS.body)
      .text(cleanText(result.overview), left, doc.y, { width, lineGap: 1.5 });
  } else {
    doc
      .font(fonts.italic)
      .fontSize(10.5)
      .fillColor(COLORS.muted)
      .text(translate(locale, `${L}.overviewEmpty`), left, doc.y, { width });
  }
  doc.moveDown(0.6);

  // ── Convergent themes ──
  sectionHeading(
    doc,
    translate(locale, `${L}.convergentHeading`, {
      count: result.convergent_themes.length,
    }),
    fonts.bold,
    accent,
  );
  if (result.convergent_themes.length === 0) {
    doc
      .font(fonts.italic)
      .fontSize(10.5)
      .fillColor(COLORS.muted)
      .text(translate(locale, `${L}.convergentEmpty`), left, doc.y, { width });
    doc.moveDown(0.4);
  } else {
    for (const theme of result.convergent_themes) {
      doc.font(fonts.bold).fontSize(12);
      const titleH = doc.heightOfString(theme.title, { width: width - 130 });
      ensureSpace(doc, titleH + 50);
      const startY = doc.y;
      doc
        .font(fonts.bold)
        .fontSize(12)
        .fillColor(COLORS.ink)
        .text(theme.title, left, startY, { width: width - 130 });
      const afterTitleY = doc.y;
      const chipText = translate(locale, `${L}.studyFrequency`, {
        count: theme.study_frequency,
        total: input.totalStudies,
      });
      doc.font(fonts.bold).fontSize(8.5);
      const chipW = doc.widthOfString(chipText) + 14;
      chip(doc, chipText, left + width - chipW, startY + 1, fonts.bold, COLORS.violetSoft, COLORS.violet);
      doc.y = afterTitleY + 4;
      doc
        .font(fonts.regular)
        .fontSize(10.5)
        .fillColor(COLORS.body)
        .text(cleanText(theme.summary), left, doc.y, { width, lineGap: 1 });
      doc.moveDown(0.4);
      for (const c of theme.citations) {
        attributedQuote(doc, c.quote, resolveTitle(c.studyId), fonts);
      }
      doc.moveDown(0.5);
    }
  }

  // ── Divergences ──
  sectionHeading(
    doc,
    translate(locale, `${L}.divergencesHeading`, {
      count: result.divergences.length,
    }),
    fonts.bold,
    accent,
  );
  if (result.divergences.length === 0) {
    doc
      .font(fonts.italic)
      .fontSize(10.5)
      .fillColor(COLORS.muted)
      .text(translate(locale, `${L}.divergencesEmpty`), left, doc.y, { width });
    doc.moveDown(0.4);
  } else {
    for (const divergence of result.divergences) {
      doc.font(fonts.bold).fontSize(11);
      const descH = doc.heightOfString(divergence.description, { width });
      ensureSpace(doc, descH + 40);
      doc
        .font(fonts.bold)
        .fontSize(11)
        .fillColor(COLORS.amber)
        .text(cleanText(divergence.description), left, doc.y, { width, lineGap: 1 });
      doc.moveDown(0.4);
      for (const position of divergence.positions) {
        ensureSpace(doc, 30);
        doc
          .font(fonts.bold)
          .fontSize(10)
          .fillColor(COLORS.ink)
          .text(cleanText(position.label), left, doc.y, { width });
        doc
          .font(fonts.regular)
          .fontSize(8.5)
          .fillColor(COLORS.faint)
          .text(
            translate(locale, `${L}.positionStudies`, {
              studies: position.studyIds.map(resolveTitle).join(", "),
            }),
            left,
            doc.y,
            { width },
          );
        doc.moveDown(0.2);
        for (const c of position.citations) {
          attributedQuote(doc, c.quote, resolveTitle(c.studyId), fonts);
        }
        doc.moveDown(0.2);
      }
      doc.moveDown(0.4);
    }
  }

  // ── Study contributions (optional) ──
  if (result.study_contributions.length > 0) {
    sectionHeading(
      doc,
      translate(locale, `${L}.contributionsHeading`, {
        count: result.study_contributions.length,
      }),
      fonts.bold,
      accent,
    );
    for (const contribution of result.study_contributions) {
      ensureSpace(doc, 40);
      doc
        .font(fonts.bold)
        .fontSize(11)
        .fillColor(COLORS.ink)
        .text(resolveTitle(contribution.studyId), left, doc.y, { width });
      doc.moveDown(0.2);
      doc
        .font(fonts.regular)
        .fontSize(10.5)
        .fillColor(COLORS.body)
        .text(cleanText(contribution.summary), left, doc.y, { width, lineGap: 1 });
      doc.moveDown(0.3);
      for (const c of contribution.citations) {
        attributedQuote(doc, c.quote, resolveTitle(c.studyId), fonts);
      }
      doc.moveDown(0.4);
    }
  }

  // ── Interpretation (non-evidenced) ──
  if (result.interpretation.trim() !== "") {
    sectionHeading(
      doc,
      translate(locale, `${L}.interpretationTitle`),
      fonts.bold,
      COLORS.amber,
    );
    doc
      .font(fonts.italic)
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(cleanText(result.interpretation), left, doc.y, { width, lineGap: 1 });
    doc.moveDown(0.4);
  }

  // Model footnote.
  if (input.model) {
    ensureSpace(doc, 24);
    doc.moveDown(0.8);
    doc
      .font(fonts.regular)
      .fontSize(8)
      .fillColor(COLORS.faint)
      .text(
        translate(locale, `${L}.modelFootnote`, { model: input.model }),
        left,
        doc.y,
        { width },
      );
  }

  // ── Footer on every page (buffered) ──
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0;
    const fy = doc.page.height - 34;
    doc
      .font(fonts.regular)
      .fontSize(8)
      .fillColor(COLORS.faint)
      .text(translate(locale, `${L}.confidentialFooter`), left, fy, {
        width,
        align: "left",
        lineBreak: false,
      });
    doc.text(
      translate(locale, `${L}.pageXOfY`, { page: i + 1, total: range.count }),
      left,
      fy,
      { width, align: "right", lineBreak: false },
    );
  }

  return pdfToBuffer(doc);
}
