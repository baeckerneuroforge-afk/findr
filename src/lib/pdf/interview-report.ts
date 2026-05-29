import "server-only";

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { translate } from "@/i18n/messages";
import { toBcp47, type Locale } from "@/i18n/locale";

/**
 * "Post-Loss Interview Report" PDF — a clean, forwardable loss record built from
 * a completed post-loss interview. Same Findr style as the solution report:
 * white, calm typography, violet #5B2FD4 used sparingly as an accent.
 *
 * Typeface: Geist (brand font) is embedded as TrueType so German umlauts
 * (ü ö ä ß …) render reliably and on-brand. Falls back to Helvetica (which also
 * renders WinAnsi umlauts) if the font files can't be read, so export never
 * breaks. Repeatable blocks (conversation turns) are measured before drawing so
 * they never split awkwardly across a page.
 */

const COLORS = {
  violet: "#5B2FD4", // Findr accent — used sparingly
  violetSoft: "#efeafe", // light violet for small chips
  ink: "#18181b", // headings + key content
  body: "#3f3f46", // softer paragraph text
  muted: "#71717a", // captions, labels
  faint: "#9b9ba3", // quotes, footer
  border: "#e4e4e7",
  panel: "#f7f7f8", // soft neutral panel
  danger: "#dc2626", // "no" — coral/red
  dangerTint: "#fdecec",
  warning: "#d97706", // "partial" — amber
  warningTint: "#fdf3e6",
  success: "#16a34a", // "yes" — green
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

// Human-readable labels for the loss-reason categories stored in
// extracted_reason. UI/labels stay English; quotes + conversation keep their
// original language.
const LOSS_REASON_LABELS: Record<string, string> = {
  pricing: "Pricing",
  budget: "Budget",
  competitor: "Competitor",
  feature_gap: "Feature Gap",
  compliance: "Compliance",
  timing: "Timing",
  champion_lost: "Champion Loss",
  no_decision: "No Decision",
  internal_priority: "Internal Priority",
  other: "Other",
};

interface Fonts {
  regular: string;
  bold: string;
  italic: string;
}

export type InterviewMatch = "yes" | "no" | "partial";

export interface InterviewPdfInput {
  locale: Locale;
  deal: {
    name: string;
    company: string;
    stage: string;
    amount: number;
    currency: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
  };
  interview: {
    extractedReason: string | null;
    evidence: string | null;
    matchedRiskPrediction: InterviewMatch | null;
    reasoning: string | null;
    conversation: Array<{ role: "agent" | "customer"; text: string }>;
    createdAt: string;
    completedAt: string | null;
  };
}

// ---- formatting helpers -----------------------------------------------------

function humanize(value: string): string {
  return value
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function formatStage(stage: string): string {
  return STAGE_LABELS[stage] ?? humanize(stage);
}

function lossReasonLabel(reason: string | null): string {
  if (!reason) return "Unknown";
  return LOSS_REASON_LABELS[reason] ?? humanize(reason);
}

function formatCurrency(value: number, currency: string, locale: Locale): string {
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

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function matchColor(m: InterviewMatch): string {
  if (m === "yes") return COLORS.success;
  if (m === "no") return COLORS.danger;
  return COLORS.warning;
}

function matchTint(m: InterviewMatch): string {
  if (m === "yes") return COLORS.successTint;
  if (m === "no") return COLORS.dangerTint;
  return COLORS.warningTint;
}

function matchLabel(m: InterviewMatch, locale: Locale): string {
  if (m === "yes") return translate(locale, "export.interview.predictionRight");
  if (m === "no") return translate(locale, "export.interview.predictionOff");
  return translate(locale, "export.interview.predictionPartial");
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
      "[interview-pdf] Geist fonts unavailable; falling back to Helvetica:",
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

// ---- builder ----------------------------------------------------------------

export async function buildInterviewReportPdf(
  input: InterviewPdfInput,
): Promise<Buffer> {
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

  const locale = input.locale;
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const completedAt = input.interview.completedAt ?? input.interview.createdAt;

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
      translate(locale, "export.interview.generated", {
        date: formatDate(completedAt, locale),
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
    .text(translate(locale, "export.interview.title"), left, doc.y);
  doc.moveDown(0.2);
  doc
    .font(fonts.regular)
    .fontSize(11)
    .fillColor(COLORS.muted)
    .text(`${input.deal.name} · ${input.deal.company}`, left, doc.y);
  doc.moveDown(0.5);
  doc.rect(left, doc.y, 64, 2.5).fill(COLORS.violet);
  doc.y += 22;

  // ---- Deal context panel ----
  const contact =
    [input.deal.contactName, input.deal.contactEmail]
      .map((v) => v?.trim())
      .filter((v): v is string => Boolean(v))
      .join(" · ") || "—";
  const dealRows: Array<[string, string]> = [
    [translate(locale, "export.interview.fieldCompany"), input.deal.company],
    [translate(locale, "export.interview.fieldContact"), contact],
    [
      translate(locale, "export.interview.fieldAmount"),
      formatCurrency(input.deal.amount, input.deal.currency, locale),
    ],
    [translate(locale, "export.interview.fieldStage"), formatStage(input.deal.stage)],
  ];
  const boxH = 34 + dealRows.length * 18 + 6;
  const bandY = doc.y;
  doc.roundedRect(left, bandY, width, boxH, 8).fill(COLORS.panel);
  doc
    .font(fonts.bold)
    .fontSize(9)
    .fillColor(COLORS.violet)
    .text(translate(locale, "export.interview.dealContext"), left + 14, bandY + 14, {
      width: width - 28,
      lineBreak: false,
    });
  let cy = bandY + 34;
  for (const [k, v] of dealRows) {
    doc
      .font(fonts.regular)
      .fontSize(9.5)
      .fillColor(COLORS.muted)
      .text(k, left + 14, cy, { width: 70, lineBreak: false });
    doc
      .font(fonts.bold)
      .fontSize(9.5)
      .fillColor(COLORS.ink)
      .text(truncate(v, 78), left + 90, cy, {
        width: width - 104,
        lineBreak: false,
      });
    cy += 18;
  }
  doc.y = bandY + boxH;

  // ---- Interview result (centerpiece) ----
  sectionHeading(doc, translate(locale, "export.interview.resultHeading"), fonts.bold);
  const mp = input.interview.matchedRiskPrediction;

  // Prominent, color-coded prediction-match banner (mirrors the solution
  // salvageable banner).
  const bannerH = 50;
  ensureSpace(doc, bannerH + 24);
  const by = doc.y;
  const color = mp ? matchColor(mp) : COLORS.muted;
  const tint = mp ? matchTint(mp) : COLORS.panel;
  doc.roundedRect(left, by, width, bannerH, 8).fill(tint);
  doc.roundedRect(left + 12, by + 11, 4, bannerH - 22, 2).fill(color);
  doc
    .font(fonts.regular)
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(
      translate(locale, "export.interview.predictionQuestion"),
      left + 26,
      by + 12,
      {
        width: width - 40,
        lineBreak: false,
      },
    );
  doc
    .font(fonts.bold)
    .fontSize(17)
    .fillColor(color)
    .text(
      mp ? matchLabel(mp, locale) : translate(locale, "export.interview.notAssessed"),
      left + 26,
      by + 24,
      {
        width: width - 40,
        lineBreak: false,
      },
    );
  doc.y = by + bannerH + 16;

  // Real loss reason
  doc
    .font(fonts.regular)
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(translate(locale, "export.interview.realLossReason"), left, doc.y, {
      width,
      lineBreak: false,
    });
  doc.y += 13;
  doc
    .font(fonts.bold)
    .fontSize(15)
    .fillColor(COLORS.ink)
    .text(lossReasonLabel(input.interview.extractedReason), left, doc.y, {
      width,
    });
  doc.moveDown(0.55);

  // AI reasoning (how the real reason relates to the prediction)
  if (input.interview.reasoning?.trim()) {
    doc
      .font(fonts.regular)
      .fontSize(10.5)
      .fillColor(COLORS.body)
      .text(cleanText(input.interview.reasoning), left, doc.y, {
        width,
        lineGap: 1,
      });
    doc.moveDown(0.7);
  }

  // Evidence quote (kept in original language)
  if (input.interview.evidence?.trim()) {
    const quote = `“${cleanText(input.interview.evidence)}”`;
    doc.font(fonts.italic).fontSize(10);
    const qh = doc.heightOfString(quote, { width: width - 18 });
    ensureSpace(doc, qh + 30);
    doc
      .font(fonts.regular)
      .fontSize(8.5)
      .fillColor(COLORS.muted)
      .text(translate(locale, "export.interview.buyerWords"), left, doc.y, {
        width,
        lineBreak: false,
      });
    doc.y += 13;
    const qy = doc.y;
    doc.roundedRect(left, qy, 3, qh, 1.5).fill(COLORS.violet);
    doc
      .font(fonts.italic)
      .fontSize(10)
      .fillColor(COLORS.body)
      .text(quote, left + 14, qy, { width: width - 18, lineGap: 1 });
    doc.y = qy + qh;
    doc.moveDown(0.4);
  }

  // ---- Conversation ----
  sectionHeading(doc, translate(locale, "export.interview.conversationHeading"), fonts.bold);
  const conversation = input.interview.conversation;
  if (conversation.length === 0) {
    doc
      .font(fonts.regular)
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(translate(locale, "export.interview.noConversation"), left, doc.y, {
        width,
      });
  } else {
    const usable =
      doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 40;
    for (const turn of conversation) {
      const speaker =
        turn.role === "agent"
          ? "Findr"
          : translate(locale, "export.interview.speakerBuyer");
      const text = cleanText(turn.text);

      doc.font(fonts.regular).fontSize(10);
      const blockH = doc.heightOfString(text, { width }) + 16;
      // Keep the speaker label with at least the start of its text; long turns
      // flow naturally onto the next page.
      ensureSpace(doc, Math.min(blockH + 6, usable));

      doc
        .font(fonts.bold)
        .fontSize(8.5)
        .fillColor(turn.role === "agent" ? COLORS.violet : COLORS.muted)
        .text(speaker, left, doc.y, { width, lineBreak: false });
      doc.y += 12;
      doc
        .font(fonts.regular)
        .fontSize(10)
        .fillColor(COLORS.body)
        .text(text, left, doc.y, { width, lineGap: 1 });
      doc.moveDown(0.7);
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
      .text(translate(locale, "export.interview.footer"), left, fy, {
        width,
        align: "left",
        lineBreak: false,
      });
    doc.text(
      translate(locale, "export.interview.pageOf", {
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
