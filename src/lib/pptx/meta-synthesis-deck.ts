import "server-only";

import PptxGenJS from "pptxgenjs";

import type {
  MetaSynthesisConvergentTheme,
  MetaSynthesisDivergence,
  MetaSynthesisContribution,
} from "@/lib/schemas/meta-synthesis";
import type { MetaSynthesisPdfInput } from "@/lib/pdf/meta-synthesis-report";
import { translate } from "@/i18n/messages";
import { type Locale, toBcp47 } from "@/i18n/locale";

/**
 * "Meta-Synthesis" PowerPoint — the presentable sibling of buildMetaSynthesisPdf.
 * SAME DATA CONTRACT (reuses MetaSynthesisPdfInput), so ONE data path feeds both
 * formats; this file only re-renders the already-prepared, anchor-filtered
 * artifact into slides. STRICTLY ADDITIVE + self-contained (type-only import from
 * the PDF report). UTF-8 XML → umlauts render natively, no font embedding.
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
  amber: "854F0B",
  white: "FFFFFF",
} as const;

const FONT = "Arial";
const PAGE_W = 13.33;
const PAGE_H = 7.5;
const MARGIN = 0.62;
const CONTENT_W = PAGE_W - MARGIN * 2;

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

type Slide = PptxGenJS.Slide;

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
  slide.addText(translate(locale, "export.metaSynthesis.confidentialFooter"), {
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

export async function buildMetaSynthesisPptx(
  input: MetaSynthesisPdfInput,
): Promise<Buffer> {
  const { result, orgName, locale } = input;
  const brandName = input.branding?.brandName || "Klymeo";
  const accentNoHash = (input.branding?.accentColorHex || "#" + COLORS.violet).replace(
    /^#/,
    "",
  );
  const titleByStudy = new Map(
    input.studies.map((s) => [s.studyId, s.studyTitle]),
  );
  const resolveTitle = (studyId: string): string =>
    titleByStudy.get(studyId) ?? studyId;

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = brandName;
  pptx.company = orgName;
  pptx.title = `${translate(locale, "export.metaSynthesis.title")} — ${input.title}`;

  addTitleSlide(pptx, input, brandName, accentNoHash);
  addOverviewSlide(pptx, input, brandName, accentNoHash);
  if (result.executive_narrative.trim() !== "") {
    addNarrativeSlide(pptx, input, brandName, accentNoHash);
  }
  for (const theme of result.convergent_themes) {
    addThemeSlide(pptx, theme, input, resolveTitle, brandName, accentNoHash);
  }
  for (const divergence of result.divergences) {
    addDivergenceSlide(pptx, divergence, locale, resolveTitle, brandName, accentNoHash);
  }
  if (result.study_contributions.length > 0) {
    addContributionsSlide(pptx, result.study_contributions, locale, resolveTitle, brandName, accentNoHash);
  }
  if (result.interpretation.trim() !== "" || input.model) {
    addClosingSlide(pptx, input, brandName, accentNoHash);
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as unknown as Buffer;
}

function addTitleSlide(
  pptx: PptxGenJS,
  input: MetaSynthesisPdfInput,
  brandName: string,
  accentNoHash: string,
): void {
  const { locale } = input;
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };

  let brandRendered = false;
  if (input.branding?.logo) {
    try {
      slide.addImage({
        data: input.branding.logo.dataUrl,
        x: MARGIN,
        y: 0.7,
        sizing: { type: "contain", w: 1.2, h: 0.45 },
      });
      brandRendered = true;
    } catch (err) {
      console.warn(
        "[meta-synthesis-pptx] logo embed failed; falling back to brand text:",
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

  slide.addText(translate(locale, "export.metaSynthesis.title"), {
    x: MARGIN,
    y: 1.9,
    w: CONTENT_W,
    h: 1.0,
    fontFace: FONT,
    fontSize: 40,
    bold: true,
    color: COLORS.ink,
    align: "left",
  });
  slide.addText(truncate(input.title, 160), {
    x: MARGIN,
    y: 2.95,
    w: CONTENT_W,
    h: 0.7,
    fontFace: FONT,
    fontSize: 18,
    color: COLORS.muted,
    align: "left",
  });
  slide.addShape("rect", {
    x: MARGIN,
    y: 3.75,
    w: 1.1,
    h: 0.05,
    fill: { color: accentNoHash },
  });
  slide.addText(
    translate(locale, "export.metaSynthesis.subtitleLine", {
      studies: input.totalStudies,
      interviews: input.totalInterviews,
      date: formatDate(input.createdAt, locale),
    }),
    {
      x: MARGIN,
      y: 4.1,
      w: CONTENT_W,
      h: 0.4,
      fontFace: FONT,
      fontSize: 13,
      color: COLORS.muted,
      align: "left",
    },
  );

  // Compared-studies panel.
  const runs: PptxGenJS.TextProps[] = [
    {
      text: translate(locale, "export.metaSynthesis.comparedStudies"),
      options: { color: COLORS.violet, bold: true, fontSize: 11, breakLine: true },
    },
  ];
  for (const s of input.studies) {
    runs.push({
      text: `• ${truncate(s.studyTitle, 90)}  (${translate(locale, "export.synthesis.interviewsMany", { n: s.basedOnCount })})`,
      options: { color: COLORS.body, fontSize: 12, breakLine: true, paraSpaceBefore: 4 },
    });
  }
  slide.addText(runs, {
    x: MARGIN,
    y: 4.9,
    w: CONTENT_W,
    h: 2.0,
    fontFace: FONT,
    align: "left",
    valign: "top",
    fill: { color: COLORS.panel },
    line: { color: COLORS.border, width: 1 },
    margin: 14,
  });
}

function addOverviewSlide(
  pptx: PptxGenJS,
  input: MetaSynthesisPdfInput,
  brandName: string,
  accentNoHash: string,
): void {
  const { result, locale } = input;
  const slide = pptx.addSlide();
  const heading = translate(locale, "export.metaSynthesis.overview");
  const top = chrome(slide, heading, locale, brandName, accentNoHash);

  slide.addText(heading, {
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
  const hasOverview = result.overview.trim() !== "";
  slide.addText(
    hasOverview
      ? truncate(result.overview, 1400)
      : translate(locale, "export.metaSynthesis.overviewEmpty"),
    {
      x: MARGIN,
      y: top + 1.0,
      w: CONTENT_W,
      h: PAGE_H - top - 1.6,
      fontFace: FONT,
      fontSize: 16,
      color: COLORS.body,
      align: "left",
      valign: "top",
      italic: !hasOverview,
      lineSpacingMultiple: 1.2,
    },
  );
}

/** Ausführlicher Überblick — die optionale Erzähl-Stufe als eigene Folie. */
function addNarrativeSlide(
  pptx: PptxGenJS,
  input: MetaSynthesisPdfInput,
  brandName: string,
  accentNoHash: string,
): void {
  const { result, locale } = input;
  const heading = translate(locale, "export.metaSynthesis.narrativeHeading");
  const slide = pptx.addSlide();
  const top = chrome(slide, heading, locale, brandName, accentNoHash);

  slide.addText(heading, {
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
  slide.addText(truncate(result.executive_narrative, 1600), {
    x: MARGIN,
    y: top + 1.0,
    w: CONTENT_W,
    h: PAGE_H - top - 1.6,
    fontFace: FONT,
    fontSize: 16,
    color: COLORS.body,
    align: "left",
    valign: "top",
    lineSpacingMultiple: 1.25,
  });
}

/** Quote runs with per-study attribution — the meta-specific value in the deck. */
function citationRuns(
  citations: { studyId: string; quote: string }[],
  resolveTitle: (id: string) => string,
): PptxGenJS.TextProps[] {
  const runs: PptxGenJS.TextProps[] = [];
  for (const c of citations.slice(0, 4)) {
    runs.push({
      text: `„${truncate(c.quote, 220)}"`,
      options: { color: COLORS.body, italic: true, fontSize: 12, breakLine: true, paraSpaceBefore: 6 },
    });
    runs.push({
      text: `— ${resolveTitle(c.studyId)}`,
      options: { color: COLORS.violet, bold: true, fontSize: 9.5, breakLine: true },
    });
  }
  return runs;
}

function addThemeSlide(
  pptx: PptxGenJS,
  theme: MetaSynthesisConvergentTheme,
  input: MetaSynthesisPdfInput,
  resolveTitle: (id: string) => string,
  brandName: string,
  accentNoHash: string,
): void {
  const { locale } = input;
  const slide = pptx.addSlide();
  const top = chrome(
    slide,
    translate(locale, "export.synthesis.kickerTheme"),
    locale,
    brandName,
    accentNoHash,
  );

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
  slide.addText(
    translate(locale, "export.metaSynthesis.studyFrequency", {
      count: theme.study_frequency,
      total: input.totalStudies,
    }),
    {
      x: PAGE_W - MARGIN - 2.3,
      y: top + 0.05,
      w: 2.3,
      h: 0.42,
      fontFace: FONT,
      fontSize: 11,
      bold: true,
      color: COLORS.violet,
      align: "center",
      valign: "middle",
      fill: { color: COLORS.violetSoft },
      rectRadius: 0.1,
      shape: "roundRect",
    },
  );
  slide.addText(truncate(theme.summary, 420), {
    x: MARGIN,
    y: top + 0.95,
    w: CONTENT_W,
    h: 1.0,
    fontFace: FONT,
    fontSize: 14,
    color: COLORS.body,
    align: "left",
    valign: "top",
    lineSpacingMultiple: 1.1,
  });
  slide.addText(citationRuns(theme.citations, resolveTitle), {
    x: MARGIN,
    y: top + 2.05,
    w: CONTENT_W,
    h: PAGE_H - top - 2.7,
    fontFace: FONT,
    align: "left",
    valign: "top",
  });
}

function addDivergenceSlide(
  pptx: PptxGenJS,
  divergence: MetaSynthesisDivergence,
  locale: Locale,
  resolveTitle: (id: string) => string,
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

  slide.addText(truncate(divergence.description, 320), {
    x: MARGIN,
    y: top,
    w: CONTENT_W,
    h: 1.0,
    fontFace: FONT,
    fontSize: 20,
    bold: true,
    color: COLORS.amber,
    align: "left",
    valign: "top",
    lineSpacingMultiple: 1.05,
  });

  const runs: PptxGenJS.TextProps[] = [];
  for (const position of divergence.positions) {
    runs.push({
      text: truncate(position.label, 160),
      options: { color: COLORS.ink, bold: true, fontSize: 15, breakLine: true, paraSpaceBefore: 10 },
    });
    runs.push({
      text: translate(locale, "export.metaSynthesis.positionStudies", {
        studies: position.studyIds.map(resolveTitle).join(", "),
      }),
      options: { color: COLORS.faint, fontSize: 9.5, breakLine: true },
    });
    for (const c of position.citations.slice(0, 2)) {
      runs.push({
        text: `„${truncate(c.quote, 200)}"  — ${resolveTitle(c.studyId)}`,
        options: { color: COLORS.body, italic: true, fontSize: 12, breakLine: true, paraSpaceBefore: 4 },
      });
    }
  }
  slide.addText(runs, {
    x: MARGIN,
    y: top + 1.2,
    w: CONTENT_W,
    h: PAGE_H - top - 1.9,
    fontFace: FONT,
    align: "left",
    valign: "top",
  });
}

function addContributionsSlide(
  pptx: PptxGenJS,
  contributions: MetaSynthesisContribution[],
  locale: Locale,
  resolveTitle: (id: string) => string,
  brandName: string,
  accentNoHash: string,
): void {
  const slide = pptx.addSlide();
  const heading = translate(locale, "export.metaSynthesis.contributionsHeading", {
    count: contributions.length,
  });
  const top = chrome(slide, heading, locale, brandName, accentNoHash);

  slide.addText(heading, {
    x: MARGIN,
    y: top,
    w: CONTENT_W,
    h: 0.6,
    fontFace: FONT,
    fontSize: 24,
    bold: true,
    color: COLORS.ink,
    align: "left",
  });

  const runs: PptxGenJS.TextProps[] = [];
  for (const contribution of contributions) {
    runs.push({
      text: resolveTitle(contribution.studyId),
      options: { color: COLORS.violet, bold: true, fontSize: 14, breakLine: true, paraSpaceBefore: 10 },
    });
    runs.push({
      text: truncate(contribution.summary, 300),
      options: { color: COLORS.body, fontSize: 12, breakLine: true },
    });
  }
  slide.addText(runs, {
    x: MARGIN,
    y: top + 0.8,
    w: CONTENT_W,
    h: PAGE_H - top - 1.5,
    fontFace: FONT,
    align: "left",
    valign: "top",
  });
}

function addClosingSlide(
  pptx: PptxGenJS,
  input: MetaSynthesisPdfInput,
  brandName: string,
  accentNoHash: string,
): void {
  const { result, locale } = input;
  const slide = pptx.addSlide();
  const heading = translate(locale, "export.metaSynthesis.interpretationTitle");
  const top = chrome(slide, heading, locale, brandName, accentNoHash);

  if (result.interpretation.trim() !== "") {
    slide.addText(heading, {
      x: MARGIN,
      y: top,
      w: CONTENT_W,
      h: 0.7,
      fontFace: FONT,
      fontSize: 22,
      bold: true,
      color: COLORS.amber,
      align: "left",
    });
    slide.addText(truncate(result.interpretation, 1200), {
      x: MARGIN,
      y: top + 0.9,
      w: CONTENT_W,
      h: PAGE_H - top - 1.6,
      fontFace: FONT,
      fontSize: 15,
      italic: true,
      color: COLORS.body,
      align: "left",
      valign: "top",
      lineSpacingMultiple: 1.2,
    });
  }

  if (input.model) {
    slide.addText(
      translate(locale, "export.metaSynthesis.modelFootnote", { model: input.model }),
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
