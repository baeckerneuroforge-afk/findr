import "server-only";

import PDFDocument from "pdfkit";

/**
 * "Deal Solution Report" PDF — a considered internal deal-review document, not a
 * data dump. Findr style: white, calm typography, violet #5B2FD4 used sparingly
 * as an accent (heading rules, the risk ring, small labels). Reuses pdfkit (the
 * repo's PDF engine); kept separate from generator.ts so the violet accent
 * doesn't touch the existing indigo loss/forecast reports.
 *
 * Layout breathes (generous whitespace) and may run 2–3 pages; repeatable
 * blocks (signals, recommendations) are measured before drawing so they never
 * get cut across a page boundary.
 *
 * NB: pdfkit's standard fonts use WinAnsi — avoid glyphs like "→"/"…".
 * Smart quotes (“ ”), middle dot (·) and en dash (–) are safe.
 */

const COLORS = {
  violet: "#5B2FD4", // Findr accent — used sparingly
  violetSoft: "#efeafe", // light violet for small chips
  ink: "#18181b", // headings + key content
  body: "#3f3f46", // softer paragraph text
  muted: "#71717a", // captions, labels
  faint: "#9b9ba3", // quotes, footer
  border: "#e4e4e7",
  track: "#e8e8ec", // donut track
  panel: "#f7f7f8", // soft neutral panel
  danger: "#dc2626",
  high: "#ea580c",
  warning: "#d97706",
  success: "#16a34a",
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

export interface SolutionPdfInput {
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

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString("de-DE")}`;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("de-DE", {
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

function salvageableLabel(s: "yes" | "no" | "maybe"): string {
  if (s === "yes") return "Salvageable";
  if (s === "no") return "Hard to save";
  return "Uncertain";
}

// ---- pdfkit helpers ---------------------------------------------------------

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
function sectionHeading(doc: PDFKit.PDFDocument, title: string): void {
  const left = doc.page.margins.left;
  ensureSpace(doc, 46);
  doc.moveDown(1.1);
  const y = doc.y;
  doc
    .font("Helvetica-Bold")
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
  const doc = new PDFDocument({ size: "A4", margin: 46, bufferPages: true });
  const left = doc.page.margins.left;
  const width = contentWidth(doc);

  // ---- Header ----
  const topY = doc.y;
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(COLORS.violet)
    .text("Findr", left, topY, { lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(`Generated ${formatDate(input.solution.createdAt)}`, left, topY + 2, {
      width,
      align: "right",
      lineBreak: false,
    });
  doc.y = topY + 26;
  doc
    .font("Helvetica-Bold")
    .fontSize(23)
    .fillColor(COLORS.ink)
    .text("Deal Solution Report", left, doc.y);
  doc.moveDown(0.2);
  doc
    .font("Helvetica")
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
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.violet)
    .text("Deal context", left + 14, bandY + 14, {
      width: leftW - 28,
      lineBreak: false,
    });
  let cy = bandY + 34;
  const dealRows: Array<[string, string]> = [
    ["Company", input.deal.company],
    ["Stage", formatStage(input.deal.stage)],
    ["Amount", formatCurrency(input.deal.amount, input.deal.currency)],
    ["Industry", input.deal.industry?.trim() || "—"],
  ];
  for (const [k, v] of dealRows) {
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(COLORS.muted)
      .text(k, left + 14, cy, { width: 66, lineBreak: false });
    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(COLORS.ink)
      .text(truncate(v, 40), left + 86, cy, {
        width: leftW - 100,
        lineBreak: false,
      });
    cy += 18;
  }

  // Right: risk gauge (donut)
  doc.roundedRect(rx, bandY, rightW, boxH, 8).fill(COLORS.panel);
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.violet)
    .text("Risk", rx + 14, bandY + 14, { width: rightW - 28, lineBreak: false });
  if (input.risk) {
    const lvlColor = riskLevelColor(input.risk.level);
    const dcx = rx + rightW / 2;
    const dcy = bandY + 56;
    drawDonut(doc, dcx, dcy, 24, 6, input.risk.score / 100, lvlColor, COLORS.track);
    doc
      .font("Helvetica-Bold")
      .fontSize(17)
      .fillColor(lvlColor)
      .text(String(input.risk.score), dcx - 26, dcy - 8, {
        width: 52,
        align: "center",
        lineBreak: false,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(lvlColor)
      .text(capitalize(input.risk.level), rx + 14, bandY + 88, {
        width: rightW - 28,
        align: "center",
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLORS.muted)
      .text(
        `${input.risk.signals.length} signal${input.risk.signals.length === 1 ? "" : "s"}`,
        rx + 14,
        bandY + 101,
        { width: rightW - 28, align: "center", lineBreak: false },
      );
  } else {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text("No risk analysis on file", rx + 14, bandY + 52, {
        width: rightW - 28,
        align: "center",
      });
  }
  doc.y = bandY + boxH;

  // ---- Analyzed call ----
  sectionHeading(doc, "Analyzed call");
  if (input.call) {
    const participants =
      input.call.participants.length > 0
        ? input.call.participants.join(", ")
        : "participants n/a";
    const more =
      input.call.totalCalls > 1
        ? `  ·  +${input.call.totalCalls - 1} more call${input.call.totalCalls - 1 === 1 ? "" : "s"}`
        : "";
    doc
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .fillColor(COLORS.ink)
      .text(input.call.title, left, doc.y, { width });
    doc.moveDown(0.15);
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(COLORS.muted)
      .text(
        `${formatDate(input.call.date)} · ${truncate(participants, 95)}${more}`,
        left,
        doc.y,
        { width },
      );
  } else {
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(COLORS.muted)
      .text("No call linked to this deal.", left, doc.y, { width });
  }

  // ---- Risk signals (name + confidence, reasoning, quote) ----
  if (input.risk && input.risk.signals.length > 0) {
    sectionHeading(doc, `Risk signals (${input.risk.signals.length})`);
    const textW = width - 16;
    for (const s of input.risk.signals) {
      const reasoning = s.reasoning ? truncate(s.reasoning, 180) : "";
      const quote = s.quote ? truncate(s.quote, 160) : "";

      // Measure the whole block so it never splits across a page.
      let h = 16;
      if (reasoning) {
        doc.font("Helvetica").fontSize(9.5);
        h += doc.heightOfString(reasoning, { width: textW }) + 3;
      }
      if (quote) {
        doc.font("Helvetica-Oblique").fontSize(9);
        h += doc.heightOfString(`“${quote}”`, { width: textW }) + 3;
      }
      ensureSpace(doc, h + 12);

      const y = doc.y;
      doc.circle(left + 4, y + 5, 3).fill(confidenceColor(s.confidence));
      doc
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .fillColor(COLORS.ink)
        .text(formatSignal(s.type), left + 14, y, {
          width: width - 64,
          lineBreak: false,
        });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(`${Math.round(s.confidence * 100)}% confidence`, left, y, {
          width,
          align: "right",
          lineBreak: false,
        });
      doc.y = y + 16;
      if (reasoning) {
        doc
          .font("Helvetica")
          .fontSize(9.5)
          .fillColor(COLORS.body)
          .text(reasoning, left + 14, doc.y, { width: textW });
        doc.moveDown(0.2);
      }
      if (quote) {
        doc
          .font("Helvetica-Oblique")
          .fontSize(9)
          .fillColor(COLORS.faint)
          .text(`“${quote}”`, left + 14, doc.y, { width: textW });
      }
      doc.moveDown(0.85);
    }
  }

  // ---- Solution (centerpiece) ----
  sectionHeading(doc, "Solution");
  const sv = input.solution.salvageable;
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text("Can this deal be saved?", left, doc.y, { lineBreak: false });
  doc.y += 15;
  const pillLabel = salvageableLabel(sv);
  doc.font("Helvetica-Bold").fontSize(9.5);
  const pillW = doc.widthOfString(pillLabel) + 22;
  const pillY = doc.y;
  doc.roundedRect(left, pillY, pillW, 20, 10).fill(salvageableColor(sv));
  doc
    .fillColor(COLORS.white)
    .text(pillLabel, left + 11, pillY + 6, { lineBreak: false });
  doc.y = pillY + 28;
  if (input.solution.reasoning) {
    doc
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(COLORS.body)
      .text(input.solution.reasoning, left, doc.y, { width, lineGap: 1 });
  }
  doc.moveDown(0.9);

  const recs = input.solution.recommendations;
  if (recs.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(COLORS.success)
      .text("No rescue actions needed — this deal looks healthy.", left, doc.y, {
        width,
      });
  } else {
    for (const rec of recs) {
      const evidence = rec.evidence ? truncate(rec.evidence, 170) : "";

      // Measure the whole card so chip + body + next step + evidence stay
      // together on one page.
      let h = 22;
      doc.font("Helvetica").fontSize(10.5);
      h += doc.heightOfString(rec.recommendation, { width }) + 5;
      doc.font("Helvetica-Bold").fontSize(9.5);
      h += doc.heightOfString(`Next step:  ${rec.nextStep}`, { width }) + 5;
      if (evidence) {
        doc.font("Helvetica-Oblique").fontSize(9);
        h += doc.heightOfString(`“${evidence}”`, { width }) + 5;
      }
      ensureSpace(doc, h + 14);

      // Signal chip (mixed case, light-violet accent)
      const chip = formatSignal(rec.signal);
      doc.font("Helvetica-Bold").fontSize(8.5);
      const chipW = doc.widthOfString(chip) + 16;
      const chipY = doc.y;
      doc.roundedRect(left, chipY, chipW, 16, 8).fill(COLORS.violetSoft);
      doc
        .fillColor(COLORS.violet)
        .text(chip, left + 8, chipY + 4.5, { lineBreak: false });
      doc.y = chipY + 23;

      // Recommendation
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .fillColor(COLORS.ink)
        .text(rec.recommendation, left, doc.y, { width, lineGap: 1 });
      doc.moveDown(0.25);

      // Next step (clearly set off)
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(COLORS.violet)
        .text("Next step:  ", left, doc.y, { continued: true });
      doc.font("Helvetica").fillColor(COLORS.ink).text(rec.nextStep, { lineGap: 1 });

      // Evidence quote (anchors the recommendation)
      if (evidence) {
        doc.moveDown(0.25);
        doc
          .font("Helvetica-Oblique")
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
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.faint)
      .text(`Findr · Deal Solution Report · ${input.solution.model}`, left, fy, {
        width,
        align: "left",
        lineBreak: false,
      });
    doc.text(`Page ${i + 1} of ${range.count}`, left, fy, {
      width,
      align: "right",
      lineBreak: false,
    });
  }

  return pdfToBuffer(doc);
}
