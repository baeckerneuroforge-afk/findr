import "server-only";

import PptxGenJS from "pptxgenjs";

import type { EmergentTheme, Tension, TensionSide } from "@/lib/schemas/synthesis";
import type { SynthesisPdfInput } from "@/lib/pdf/synthesis-report";
import { translate } from "@/i18n/messages";
import { type Locale, toBcp47 } from "@/i18n/locale";

/**
 * "Research Synthesis" PowerPoint — a forwardable, presentable read-out of a
 * Stage-2 study synthesis. Second shareout option next to the PDF export
 * (buildSynthesisPdf). Same Findr palette (violet #4A51A8 accent on white),
 * but a slide-per-theme deck instead of a flowing document.
 *
 * SAME DATA CONTRACT as the PDF export — this deliberately reuses the exact
 * `SynthesisPdfInput` shape produced by the PDF route, so there is ONE data
 * path feeding both formats. This file does NOT aggregate, re-fetch, or
 * re-derive anything; it only re-renders the already-prepared synthesis into
 * PPTX. STRICTLY ADDITIVE — it does not import runtime from or modify
 * synthesis-report.ts (the type import is type-only).
 *
 * No custom font embedding is needed: PPTX is UTF-8 XML, so German umlauts
 * (ü ö ä ß …) render natively in PowerPoint/Keynote/Google Slides with the
 * default sans typeface.
 */

const COLORS = {
  violet: "4A51A8",
  violetSoft: "EDEDF6",
  ink: "18181B",
  body: "3F3F46",
  muted: "71717A",
  faint: "9B9BA3",
  border: "E4E4E7",
  panel: "F7F7F8",
  white: "FFFFFF",
} as const;

const FONT = "Arial";

// LAYOUT_WIDE = 13.33in × 7.5in. All positions below are in inches.
const PAGE_W = 13.33;
const PAGE_H = 7.5;
const MARGIN = 0.62;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── formatting helpers (mirror synthesis-report.ts) ──────────────────────────

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
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function sourceLabel(side: TensionSide, locale: Locale): string {
  return side.sourceInsightIds.length === 1
    ? translate(locale, "export.synthesis.sourceOne")
    : translate(locale, "export.synthesis.sourceMany", {
        n: side.sourceInsightIds.length,
      });
}

// ── slide chrome ─────────────────────────────────────────────────────────────

type Slide = PptxGenJS.Slide;

/** Small brand wordmark + accent bar in the top-left of a content
 *  slide, plus a discreet footer. Returns the y-offset where body content
 *  may begin. Falls back to "Findr" + violet #4A51A8 when branding is unset. */
function chrome(
  slide: Slide,
  kicker: string,
  locale: Locale,
  brandName: string,
  accentNoHash: string,
): number {
  slide.background = { color: COLORS.white };
  slide.addText(
    [
      { text: brandName, options: { color: accentNoHash, bold: true } },
      { text: `   ${kicker}`, options: { color: COLORS.muted, bold: false } },
    ],
    {
      x: MARGIN,
      y: 0.32,
      w: CONTENT_W,
      h: 0.3,
      fontFace: FONT,
      fontSize: 11,
      align: "left",
      valign: "middle",
    },
  );
  slide.addShape("rect", {
    x: MARGIN,
    y: 0.72,
    w: 0.55,
    h: 0.03,
    fill: { color: accentNoHash },
  });
  slide.addText(translate(locale, "export.synthesis.confidentialFooter"), {
    x: MARGIN,
    y: PAGE_H - 0.42,
    w: CONTENT_W,
    h: 0.28,
    fontFace: FONT,
    fontSize: 8,
    color: COLORS.faint,
    align: "left",
    valign: "middle",
  });
  return 0.95;
}

// ── builder ──────────────────────────────────────────────────────────────────

export async function buildSynthesisPptx(input: SynthesisPdfInput): Promise<Buffer> {
  const { plan, synthesis, orgName, locale } = input;

  // White-label brand mark + accent — fall back to today's exact "Findr" +
  // violet #4A51A8 when branding is unset. COLORS here are hex WITHOUT '#',
  // so strip a leading '#' from the resolved accent.
  const brandName = input.branding?.brandName || "Findr";
  const accentNoHash = (input.branding?.accentColorHex || "#" + COLORS.violet).replace(
    /^#/,
    "",
  );

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = brandName;
  pptx.company = orgName;
  pptx.title = `${translate(locale, "export.synthesis.title")} — ${plan.title}`;

  addTitleSlide(pptx, input, brandName, accentNoHash);
  for (const theme of synthesis.emergent_themes) {
    addThemeSlide(pptx, theme, synthesis.based_on_count, locale, brandName, accentNoHash);
  }
  for (const tension of synthesis.tensions) {
    addTensionSlide(pptx, tension, locale, brandName, accentNoHash);
  }
  addClosingSlide(pptx, input, brandName, accentNoHash);

  // pptxgenjs returns a Node Buffer for outputType "nodebuffer" (its public
  // type union omits Buffer, hence the assertion).
  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as unknown as Buffer;
}

// ── slides ────────────────────────────────────────────────────────────────────

function addTitleSlide(
  pptx: PptxGenJS,
  input: SynthesisPdfInput,
  brandName: string,
  accentNoHash: string,
): void {
  const { plan, synthesis, orgName, locale } = input;
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };

  // Customer logo INSTEAD of the brand text when present; fall back to text on
  // any addImage failure so the deck never breaks on a bad asset.
  let brandRendered = false;
  if (input.branding?.logo) {
    try {
      slide.addImage({
        data: input.branding.logo.dataUrl,
        x: MARGIN,
        y: 0.7,
        // contain: fit within the box preserving aspect ratio (no stretch),
        // mirroring the PDF path's height-only embed.
        sizing: { type: "contain", w: 1.2, h: 0.45 },
      });
      brandRendered = true;
    } catch (err) {
      console.warn(
        "[synthesis-pptx] logo embed failed; falling back to brand text:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  if (!brandRendered) {
    slide.addText(brandName, {
      x: MARGIN,
      y: 0.7,
      w: CONTENT_W,
      h: 0.4,
      fontFace: FONT,
      fontSize: 14,
      bold: true,
      color: accentNoHash,
      align: "left",
    });
  }

  slide.addText(translate(locale, "export.synthesis.title"), {
    x: MARGIN,
    y: 2.0,
    w: CONTENT_W,
    h: 1.0,
    fontFace: FONT,
    fontSize: 40,
    bold: true,
    color: COLORS.ink,
    align: "left",
  });

  slide.addText(truncate(plan.title, 160), {
    x: MARGIN,
    y: 3.05,
    w: CONTENT_W,
    h: 0.7,
    fontFace: FONT,
    fontSize: 18,
    color: COLORS.muted,
    align: "left",
  });

  slide.addShape("rect", {
    x: MARGIN,
    y: 3.85,
    w: 1.1,
    h: 0.05,
    fill: { color: accentNoHash },
  });

  const interviewsLabel =
    synthesis.based_on_count === 1
      ? translate(locale, "export.synthesis.interviewsOne")
      : translate(locale, "export.synthesis.interviewsMany", {
          n: synthesis.based_on_count,
        });
  slide.addText(
    translate(locale, "export.synthesis.subtitleLine", {
      interviews: interviewsLabel,
      date: formatDate(synthesis.synthesized_at, locale),
      org: orgName,
    }),
    {
      x: MARGIN,
      y: 4.2,
      w: CONTENT_W,
      h: 0.4,
      fontFace: FONT,
      fontSize: 13,
      color: COLORS.muted,
      align: "left",
    },
  );

  // Study context: objective + optional persona.
  const ctx: PptxGenJS.TextProps[] = [
    {
      text: translate(locale, "export.synthesis.objective"),
      options: { color: COLORS.violet, bold: true, fontSize: 11, breakLine: true },
    },
    {
      text: truncate(plan.objective, 260),
      options: { color: COLORS.body, fontSize: 12, breakLine: true },
    },
  ];
  if (plan.persona && plan.persona.trim() !== "") {
    ctx.push({
      text: translate(locale, "export.synthesis.persona"),
      options: {
        color: COLORS.violet,
        bold: true,
        fontSize: 11,
        breakLine: true,
        paraSpaceBefore: 8,
      },
    });
    ctx.push({
      text: truncate(plan.persona, 260),
      options: { color: COLORS.body, fontSize: 12, breakLine: true },
    });
  }
  slide.addText(ctx, {
    x: MARGIN,
    y: 5.0,
    w: CONTENT_W,
    h: 1.9,
    fontFace: FONT,
    align: "left",
    valign: "top",
    fill: { color: COLORS.panel },
    line: { color: COLORS.border, width: 1 },
    margin: 14,
  });
}

function addThemeSlide(
  pptx: PptxGenJS,
  theme: EmergentTheme,
  totalParticipants: number,
  locale: Locale,
  brandName: string,
  accentNoHash: string,
): void {
  const slide = pptx.addSlide();
  const top = chrome(
    slide,
    translate(locale, "export.synthesis.kickerTheme"),
    locale,
    brandName,
    accentNoHash,
  );

  // Title + frequency chip on the same row.
  slide.addText(truncate(theme.title, 120), {
    x: MARGIN,
    y: top,
    w: CONTENT_W - 2.6,
    h: 0.8,
    fontFace: FONT,
    fontSize: 24,
    bold: true,
    color: COLORS.ink,
    align: "left",
    valign: "top",
  });

  const chipText =
    theme.frequency === 1
      ? translate(locale, "export.synthesis.interviewsOne")
      : translate(locale, "export.synthesis.freqOfTotal", {
          freq: theme.frequency,
          total: totalParticipants,
        });
  slide.addText(chipText, {
    x: PAGE_W - MARGIN - 2.3,
    y: top + 0.05,
    w: 2.3,
    h: 0.42,
    fontFace: FONT,
    fontSize: 12,
    bold: true,
    color: COLORS.violet,
    align: "center",
    valign: "middle",
    fill: { color: COLORS.violetSoft },
    rectRadius: 0.1,
    shape: "roundRect",
  });

  // Summary.
  slide.addText(truncate(theme.summary, 420), {
    x: MARGIN,
    y: top + 0.95,
    w: CONTENT_W,
    h: 1.1,
    fontFace: FONT,
    fontSize: 14,
    color: COLORS.body,
    align: "left",
    valign: "top",
    lineSpacingMultiple: 1.1,
  });

  // Up to 3 key quotes, each with a violet accent bar.
  const quotes = theme.quotes.slice(0, 3);
  let qy = top + 2.15;
  const quoteH = 0.92;
  for (const q of quotes) {
    slide.addShape("rect", {
      x: MARGIN,
      y: qy,
      w: 0.05,
      h: quoteH - 0.1,
      fill: { color: COLORS.violet },
    });
    slide.addText(`„${truncate(q, 260)}"`, {
      x: MARGIN + 0.22,
      y: qy,
      w: CONTENT_W - 0.22,
      h: quoteH - 0.1,
      fontFace: FONT,
      fontSize: 13,
      italic: true,
      color: COLORS.body,
      align: "left",
      valign: "top",
      lineSpacingMultiple: 1.05,
    });
    qy += quoteH;
  }

  // Source-interview footnote (honest count — quotes aren't individually
  // mapped to a single interview in the synthesis data).
  const srcLabel =
    theme.sourceInsightIds.length === 1
      ? translate(locale, "export.synthesis.sourceOne")
      : translate(locale, "export.synthesis.sourceMany", {
          n: theme.sourceInsightIds.length,
        });
  const extra =
    theme.quotes.length > quotes.length
      ? `   ·   ${translate(locale, "export.synthesis.moreQuotesInDashboard", {
          count: theme.quotes.length - quotes.length,
        })}`
      : "";
  slide.addText(`${srcLabel}${extra}`, {
    x: MARGIN,
    y: PAGE_H - 0.78,
    w: CONTENT_W,
    h: 0.3,
    fontFace: FONT,
    fontSize: 9.5,
    color: COLORS.faint,
    align: "left",
  });
}

function addTensionSlide(
  pptx: PptxGenJS,
  tension: Tension,
  locale: Locale,
  brandName: string,
  accentNoHash: string,
): void {
  const slide = pptx.addSlide();
  const top = chrome(
    slide,
    translate(locale, "export.synthesis.kickerTension"),
    locale,
    brandName,
    accentNoHash,
  );

  slide.addText(truncate(tension.description, 320), {
    x: MARGIN,
    y: top,
    w: CONTENT_W,
    h: 1.0,
    fontFace: FONT,
    fontSize: 20,
    bold: true,
    color: COLORS.ink,
    align: "left",
    valign: "top",
    lineSpacingMultiple: 1.05,
  });

  const colW = (CONTENT_W - 0.5) / 2;
  const colY = top + 1.2;
  const colH = PAGE_H - colY - 0.6;
  renderTensionColumn(slide, tension.side_a, MARGIN, colY, colW, colH, locale);
  renderTensionColumn(
    slide,
    tension.side_b,
    MARGIN + colW + 0.5,
    colY,
    colW,
    colH,
    locale,
  );
}

function renderTensionColumn(
  slide: Slide,
  side: TensionSide,
  x: number,
  y: number,
  w: number,
  h: number,
  locale: Locale,
): void {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: COLORS.panel },
    line: { color: COLORS.border, width: 1 },
  });

  const runs: PptxGenJS.TextProps[] = [
    {
      text: truncate(side.label, 160),
      options: { color: COLORS.ink, bold: true, fontSize: 15, breakLine: true },
    },
    {
      text: sourceLabel(side, locale),
      options: {
        color: COLORS.faint,
        fontSize: 9.5,
        breakLine: true,
        paraSpaceAfter: 8,
      },
    },
  ];
  for (const q of side.quotes.slice(0, 3)) {
    runs.push({
      text: `„${truncate(q, 200)}"`,
      options: {
        color: COLORS.body,
        italic: true,
        fontSize: 12,
        breakLine: true,
        paraSpaceBefore: 6,
      },
    });
  }
  if (side.quotes.length > 3) {
    runs.push({
      text: translate(locale, "export.synthesis.moreQuotesInDashboard", {
        count: side.quotes.length - 3,
      }),
      options: { color: COLORS.faint, fontSize: 9, breakLine: true, paraSpaceBefore: 6 },
    });
  }
  slide.addText(runs, {
    x: x + 0.18,
    y: y + 0.16,
    w: w - 0.36,
    h: h - 0.32,
    fontFace: FONT,
    align: "left",
    valign: "top",
  });
}

function addClosingSlide(
  pptx: PptxGenJS,
  input: SynthesisPdfInput,
  brandName: string,
  accentNoHash: string,
): void {
  const { synthesis, locale } = input;
  const slide = pptx.addSlide();
  const overviewHeading = translate(locale, "export.synthesis.overview");
  const top = chrome(slide, overviewHeading, locale, brandName, accentNoHash);

  slide.addText(overviewHeading, {
    x: MARGIN,
    y: top,
    w: CONTENT_W,
    h: 0.7,
    fontFace: FONT,
    fontSize: 28,
    bold: true,
    color: COLORS.ink,
    align: "left",
  });
  slide.addShape("rect", {
    x: MARGIN,
    y: top + 0.7,
    w: 0.7,
    h: 0.04,
    fill: { color: COLORS.violet },
  });

  const overview =
    synthesis.overview && synthesis.overview.trim() !== ""
      ? cleanText(synthesis.overview)
      : translate(locale, "export.synthesis.overviewEmpty");
  slide.addText(truncate(overview, 1400), {
    x: MARGIN,
    y: top + 1.0,
    w: CONTENT_W,
    h: PAGE_H - top - 1.6,
    fontFace: FONT,
    fontSize: 16,
    color: COLORS.body,
    align: "left",
    valign: "top",
    italic: !synthesis.overview || synthesis.overview.trim() === "",
    lineSpacingMultiple: 1.2,
  });

  if (synthesis.model) {
    slide.addText(
      translate(locale, "export.synthesis.modelFootnote", {
        model: synthesis.model,
      }),
      {
        x: MARGIN,
        y: PAGE_H - 0.78,
        w: CONTENT_W,
        h: 0.3,
        fontFace: FONT,
        fontSize: 9,
        color: COLORS.faint,
        align: "left",
      },
    );
  }
}
