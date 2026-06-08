import "server-only";

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { translate } from "@/i18n/messages";
import { toBcp47, type Locale } from "@/i18n/locale";

/**
 * "Deal Solution Report" PDF — a considered internal deal-review document, not a
 * data dump. Findr style: white, calm typography, violet #4A51A8 used sparingly
 * as an accent (heading rules, the risk ring, small labels).
 *
 * Typeface: Geist (the product's brand font) is embedded as a TrueType so German
 * umlauts (ü ö ä ß …) render reliably and on-brand across all PDF viewers. If
 * the font files can't be read at runtime it falls back to Helvetica, which also
 * renders WinAnsi umlauts correctly — so the export never breaks.
 *
 * Layout breathes and may run 2–3 pages; repeatable blocks (signals,
 * recommendations) are measured before drawing so they never split across a page.
 */

const COLORS = {
  violet: "#4A51A8", // Findr accent — used sparingly
  violetSoft: "#ededf6", // light violet for small chips
  ink: "#18181b", // headings + key content
  body: "#3f3f46", // softer paragraph text
  muted: "#71717a", // captions, labels
  faint: "#9b9ba3", // quotes, footer
  border: "#e4e4e7",
  track: "#e8e8ec", // donut track
  panel: "#f7f7f8", // soft neutral panel
  danger: "#dc2626",
  dangerTint: "#fdecec",
  high: "#ea580c",
  warning: "#d97706",
  warningTint: "#fdf3e6",
  success: "#16a34a",
  successTint: "#eaf6ee",
  white: "#ffffff",
} as const;

const STAGE_LABELS: Record<string, string> = {
  qualified: "Qualified",
  discovery: "Discovery",
  demo: "Demo",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  verbal_commit: "Verbal commit",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
};

interface Fonts {
  regular: string;
  bold: string;
  italic: string;
}

export interface SolutionPdfInput {
  locale: Locale;
  deal: {
    name: string;
    company: string;
    stage: string;
    amount: number;
    currency: string;
    industry?: string | null;
  };
  call: {
    title: string;
    date: string | null;
    participants: string[];
    totalCalls: number;
  } | null;
  risk: {
    score: number;
    level: string;
    signals: Array<{
      type: string;
      confidence: number;
      reasoning?: string;
      quote?: string;
    }>;
  } | null;
  solution: {
    salvageable: "yes" | "no" | "maybe";
    reasoning: string;
    recommendations: Array<{
      signal: string;
      recommendation: string;
      nextStep: string;
      evidence?: string;
    }>;
    model: string;
    createdAt: string;
  };
}

// ---- formatting helpers -----------------------------------------------------

function formatSignal(signal: string): string {
  return signal
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function formatStage(stage: string): string {
  return STAGE_LABELS[stage] ?? formatSignal(stage);
}

function formatCurrency(
  value: number,
  currency: string,
  locale: Locale,
): string {
  const bcp47 = toBcp47(locale);
  try {
    return new Intl.NumberFormat(bcp47, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString(bcp47)}`;
  }
}

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

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}...` : flat;
}

function riskLevelColor(level: string): string {
  if (level === "critical") return COLORS.danger;
  if (level === "high") return COLORS.high;
  if (level === "medium") return COLORS.warning;
  return COLORS.success;
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return COLORS.danger;
  if (c >= 0.65) return COLORS.warning;
  return COLORS.muted;
}

function salvageableColor(s: "yes" | "no" | "maybe"): string {
  if (s === "yes") return COLORS.success;
  if (s === "no") return COLORS.danger;
  return COLORS.warning;
}

function salvageableTint(s: "yes" | "no" | "maybe"): string {
  if (s === "yes") return COLORS.successTint;
  if (s === "no") return COLORS.dangerTint;
  return COLORS.warningTint;
}

function salvageableLabel(s: "yes" | "no" | "maybe", locale: Locale): string {
  if (s === "yes") return translate(locale, "export.solution.salvageableYes");
  if (s === "no") return translate(locale, "export.solution.salvageableNo");
  return translate(locale, "export.solution.salvageableMaybe");
}

// ---- pdfkit helpers ---------------------------------------------------------

/**
 * Embed Geist (brand font) for crisp, on-brand umlauts. Falls back to the
 * built-in Helvetica (which also renders WinAnsi umlauts) if the files are
 * missing, so PDF export never fails on a packaging issue.
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
      "[solution-pdf] Geist fonts unavailable; falling back to Helvetica:",
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

/** Add a page if fewer than `needed` points remain before the bottom margin. */
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

/**
 * Draw a progress donut: a full track ring plus a colored arc filled to
 * `fraction` (0–1), starting at 12 o'clock and sweeping clockwise.
 */
function drawDonut(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  radius: number,
  thickness: number,
  fraction: number,
  color: string,
  track: string,
): void {
  const f = Math.max(0, Math.min(1, fraction));
  doc.save();
  doc.lineWidth(thickness);
  doc.circle(cx, cy, radius).stroke(track);

  const start = -Math.PI / 2;
  const end = start + f * Math.PI * 2;
  const steps = Math.max(2, Math.round(72 * f));
  doc.lineCap("round");
  for (let i = 0; i <= steps; i += 1) {
    const a = start + ((end - start) * i) / steps;
    const x = cx + radius * Math.cos(a);
    const y = cy + radius * Math.sin(a);
    if (i === 0) doc.moveTo(x, y);
    else doc.lineTo(x, y);
  }
  doc.stroke(color);
  doc.restore();
}

// ---- builder ----------------------------------------------------------------

export async function buildSolutionReportPdf(
  input: SolutionPdfInput,
): Promise<Buffer> {
  const { locale } = input;
  const doc = new PDFDocument({ size: "A4", margin: 46, bufferPages: true });
  const fonts = registerFonts(doc);

  // Geist ships OpenType ligatures (ff, fi, tt). They render fine, but pdfkit's
  // font subset maps the ligature glyphs so the PDF *text layer* loses
  // characters (copy/paste & search yield "Patern" / "confdence"). Disable
  // OpenType features doc-wide so every glyph keeps its own ToUnicode mapping —
  // umlauts are precomposed glyphs and are unaffected.
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
      // Object form with explicit false actually DISABLES the features (an empty
      // array only fails to *add* them, leaving fontkit's defaults — incl. liga
      // — in place). Disable all ligature/contextual features; keep kerning.
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

  // ---- Header ----
  const topY = doc.y;
  doc
    .font(fonts.bold)
    .fontSize(13)
    .fillColor(COLORS.violet)
    .text("Findr", left, topY, { lineBreak: false });
  doc
    .font(fonts.regular)
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(
      translate(locale, "export.solution.generated", {
        date: formatDate(input.solution.createdAt, locale),
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
    .text(translate(locale, "export.solution.title"), left, doc.y);
  doc.moveDown(0.2);
  doc
    .font(fonts.regular)
    .fontSize(11)
    .fillColor(COLORS.muted)
    .text(`${input.deal.name} · ${input.deal.company}`, left, doc.y);
  doc.moveDown(0.5);
  doc.rect(left, doc.y, 64, 2.5).fill(COLORS.violet);
  doc.y += 22;

  // ---- Deal context + Risk band (two columns) ----
  const bandY = doc.y;
  const gap = 18;
  const boxH = 116;
  const leftW = Math.round(width * 0.58);
  const rightW = width - leftW - gap;
  const rx = left + leftW + gap;

  // Left: deal context
  doc.roundedRect(left, bandY, leftW, boxH, 8).fill(COLORS.panel);
  doc
    .font(fonts.bold)
    .fontSize(9)
    .fillColor(COLORS.violet)
    .text(translate(locale, "export.solution.dealContext"), left + 14, bandY + 14, {
      width: leftW - 28,
      lineBreak: false,
    });
  let cy = bandY + 34;
  const dealRows: Array<[string, string]> = [
    [translate(locale, "export.solution.fieldCompany"), input.deal.company],
    [translate(locale, "export.solution.fieldStage"), formatStage(input.deal.stage)],
    [
      translate(locale, "export.solution.fieldAmount"),
      formatCurrency(input.deal.amount, input.deal.currency, locale),
    ],
    [
      translate(locale, "export.solution.fieldIndustry"),
      input.deal.industry?.trim() || "—",
    ],
  ];
  for (const [k, v] of dealRows) {
    doc
      .font(fonts.regular)
      .fontSize(9.5)
      .fillColor(COLORS.muted)
      .text(k, left + 14, cy, { width: 66, lineBreak: false });
    doc
      .font(fonts.bold)
      .fontSize(9.5)
      .fillColor(COLORS.ink)
      .text(truncate(v, 40), left + 86, cy, {
        width: leftW - 100,
        lineBreak: false,
      });
    cy += 18;
  }

  // Right: risk gauge (donut — unchanged)
  doc.roundedRect(rx, bandY, rightW, boxH, 8).fill(COLORS.panel);
  doc
    .font(fonts.bold)
    .fontSize(9)
    .fillColor(COLORS.violet)
    .text(translate(locale, "export.solution.risk"), rx + 14, bandY + 14, {
      width: rightW - 28,
      lineBreak: false,
    });
  if (input.risk) {
    const lvlColor = riskLevelColor(input.risk.level);
    const dcx = rx + rightW / 2;
    const dcy = bandY + 56;
    drawDonut(doc, dcx, dcy, 24, 6, input.risk.score / 100, lvlColor, COLORS.track);
    doc
      .font(fonts.bold)
      .fontSize(17)
      .fillColor(lvlColor)
      .text(String(input.risk.score), dcx - 26, dcy - 8, {
        width: 52,
        align: "center",
        lineBreak: false,
      });
    doc
      .font(fonts.bold)
      .fontSize(9.5)
      .fillColor(lvlColor)
      .text(capitalize(input.risk.level), rx + 14, bandY + 88, {
        width: rightW - 28,
        align: "center",
        lineBreak: false,
      });
    doc
      .font(fonts.regular)
      .fontSize(8.5)
      .fillColor(COLORS.muted)
      .text(
        translate(
          locale,
          input.risk.signals.length === 1
            ? "export.solution.signalCountOne"
            : "export.solution.signalCountOther",
          { count: input.risk.signals.length },
        ),
        rx + 14,
        bandY + 101,
        { width: rightW - 28, align: "center", lineBreak: false },
      );
  } else {
    doc
      .font(fonts.regular)
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(
        translate(locale, "export.solution.noRiskAnalysis"),
        rx + 14,
        bandY + 52,
        {
          width: rightW - 28,
          align: "center",
        },
      );
  }
  doc.y = bandY + boxH;

  // ---- Analyzed call ----
  sectionHeading(doc, translate(locale, "export.solution.analyzedCall"), fonts.bold);
  if (input.call) {
    const participants =
      input.call.participants.length > 0
        ? input.call.participants.join(", ")
        : translate(locale, "export.solution.participantsNa");
    const more =
      input.call.totalCalls > 1
        ? `  ·  ${translate(
            locale,
            input.call.totalCalls - 1 === 1
              ? "export.solution.moreCallsOne"
              : "export.solution.moreCallsOther",
            { count: input.call.totalCalls - 1 },
          )}`
        : "";
    doc
      .font(fonts.bold)
      .fontSize(10.5)
      .fillColor(COLORS.ink)
      .text(input.call.title, left, doc.y, { width });
    doc.moveDown(0.15);
    doc
      .font(fonts.regular)
      .fontSize(9.5)
      .fillColor(COLORS.muted)
      .text(
        `${formatDate(input.call.date, locale)} · ${truncate(participants, 95)}${more}`,
        left,
        doc.y,
        { width },
      );
  } else {
    doc
      .font(fonts.regular)
      .fontSize(9.5)
      .fillColor(COLORS.muted)
      .text(translate(locale, "export.solution.noCallLinked"), left, doc.y, {
        width,
      });
  }

  // ---- Risk signals (name + confidence, reasoning, quote) ----
  if (input.risk && input.risk.signals.length > 0) {
    sectionHeading(
      doc,
      translate(locale, "export.solution.riskSignals", {
        count: input.risk.signals.length,
      }),
      fonts.bold,
    );
    const textW = width - 16;
    for (const s of input.risk.signals) {
      const reasoning = s.reasoning ? truncate(s.reasoning, 180) : "";
      const quote = s.quote ? truncate(s.quote, 160) : "";

      // Measure the whole block so it never splits across a page.
      let h = 16;
      if (reasoning) {
        doc.font(fonts.regular).fontSize(9.5);
        h += doc.heightOfString(reasoning, { width: textW }) + 3;
      }
      if (quote) {
        doc.font(fonts.italic).fontSize(9);
        h += doc.heightOfString(`“${quote}”`, { width: textW }) + 3;
      }
      ensureSpace(doc, h + 12);

      const y = doc.y;
      doc.circle(left + 4, y + 5, 3).fill(confidenceColor(s.confidence));
      doc
        .font(fonts.bold)
        .fontSize(10.5)
        .fillColor(COLORS.ink)
        .text(formatSignal(s.type), left + 14, y, {
          width: width - 64,
          lineBreak: false,
        });
      doc
        .font(fonts.regular)
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(
          translate(locale, "export.solution.confidence", {
            percent: Math.round(s.confidence * 100),
          }),
          left,
          y,
          {
            width,
            align: "right",
            lineBreak: false,
          },
        );
      doc.y = y + 16;
      if (reasoning) {
        doc
          .font(fonts.regular)
          .fontSize(9.5)
          .fillColor(COLORS.body)
          .text(reasoning, left + 14, doc.y, { width: textW });
        doc.moveDown(0.2);
      }
      if (quote) {
        doc
          .font(fonts.italic)
          .fontSize(9)
          .fillColor(COLORS.faint)
          .text(`“${quote}”`, left + 14, doc.y, { width: textW });
      }
      doc.moveDown(0.85);
    }
  }

  // ---- Solution (centerpiece) ----
  sectionHeading(doc, translate(locale, "export.solution.solution"), fonts.bold);
  const sv = input.solution.salvageable;

  // Prominent, color-coded verdict banner.
  const bannerH = 50;
  ensureSpace(doc, bannerH + 24);
  const by = doc.y;
  doc.roundedRect(left, by, width, bannerH, 8).fill(salvageableTint(sv));
  doc.roundedRect(left + 12, by + 11, 4, bannerH - 22, 2).fill(salvageableColor(sv));
  doc
    .font(fonts.regular)
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(translate(locale, "export.solution.canBeSaved"), left + 26, by + 12, {
      width: width - 40,
      lineBreak: false,
    });
  doc
    .font(fonts.bold)
    .fontSize(17)
    .fillColor(salvageableColor(sv))
    .text(salvageableLabel(sv, locale), left + 26, by + 24, {
      width: width - 40,
      lineBreak: false,
    });
  doc.y = by + bannerH + 14;

  if (input.solution.reasoning) {
    doc
      .font(fonts.regular)
      .fontSize(10.5)
      .fillColor(COLORS.body)
      .text(input.solution.reasoning, left, doc.y, { width, lineGap: 1 });
  }
  doc.moveDown(0.9);

  const recs = input.solution.recommendations;
  if (recs.length === 0) {
    doc
      .font(fonts.regular)
      .fontSize(10.5)
      .fillColor(COLORS.success)
      .text(translate(locale, "export.solution.noRescueActions"), left, doc.y, {
        width,
      });
  } else {
    for (const rec of recs) {
      const evidence = rec.evidence ? truncate(rec.evidence, 170) : "";

      // Measure the whole card so chip + body + next step + evidence stay
      // together on one page.
      let h = 22;
      doc.font(fonts.regular).fontSize(10.5);
      h += doc.heightOfString(rec.recommendation, { width }) + 5;
      doc.font(fonts.bold).fontSize(9.5);
      h +=
        doc.heightOfString(
          `${translate(locale, "export.solution.nextStep")}${rec.nextStep}`,
          { width },
        ) + 5;
      if (evidence) {
        doc.font(fonts.italic).fontSize(9);
        h += doc.heightOfString(`“${evidence}”`, { width }) + 5;
      }
      ensureSpace(doc, h + 14);

      // Signal chip (mixed case, light-violet accent)
      const chip = formatSignal(rec.signal);
      doc.font(fonts.bold).fontSize(8.5);
      const chipW = doc.widthOfString(chip) + 16;
      const chipY = doc.y;
      doc.roundedRect(left, chipY, chipW, 16, 8).fill(COLORS.violetSoft);
      doc
        .fillColor(COLORS.violet)
        .text(chip, left + 8, chipY + 4.5, { lineBreak: false });
      doc.y = chipY + 23;

      // Recommendation
      doc
        .font(fonts.regular)
        .fontSize(10.5)
        .fillColor(COLORS.ink)
        .text(rec.recommendation, left, doc.y, { width, lineGap: 1 });
      doc.moveDown(0.25);

      // Next step (clearly set off)
      doc
        .font(fonts.bold)
        .fontSize(9.5)
        .fillColor(COLORS.violet)
        .text(translate(locale, "export.solution.nextStep"), left, doc.y, {
          continued: true,
        });
      doc.font(fonts.regular).fillColor(COLORS.ink).text(rec.nextStep, { lineGap: 1 });

      // Evidence quote (anchors the recommendation)
      if (evidence) {
        doc.moveDown(0.25);
        doc
          .font(fonts.italic)
          .fontSize(9)
          .fillColor(COLORS.faint)
          .text(`“${evidence}”`, left, doc.y, { width });
      }
      doc.moveDown(1);
    }
  }

  // ---- Footer on every page (buffered) ----
  // Zero each page's bottom margin before writing in the footer band: otherwise
  // pdfkit treats a y past maxY as overflow and auto-adds a blank page per call.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0;
    const fy = doc.page.height - 34;
    doc
      .font(fonts.regular)
      .fontSize(8)
      .fillColor(COLORS.faint)
      .text(
        `Findr · ${translate(locale, "export.solution.title")} · ${input.solution.model}`,
        left,
        fy,
        {
          width,
          align: "left",
          lineBreak: false,
        },
      );
    doc.text(
      translate(locale, "export.solution.pageOf", {
        current: i + 1,
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
