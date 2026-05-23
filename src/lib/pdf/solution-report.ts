import "server-only";

import PDFDocument from "pdfkit";

/**
 * Compact (1–2 page) "Deal Solution Report" PDF — designed to be handed around
 * in a deal review, not a raw data dump. Findr style: white, violet #5B2FD4
 * accent, clean typography. Reuses pdfkit (already the repo's PDF engine); kept
 * separate from generator.ts so the violet accent doesn't touch the existing
 * indigo loss/forecast reports.
 *
 * NB: pdfkit's standard fonts use WinAnsi encoding — avoid glyphs like "→"/"…".
 * Smart quotes (“ ”), middle dot (·) and en dash (–) are safe (WinAnsi has them).
 */

const COLORS = {
  violet: "#5B2FD4", // Findr accent
  ink: "#18181b",
  muted: "#71717a",
  faint: "#a1a1aa",
  border: "#e4e4e7",
  panel: "#f4f1fd", // light violet tint
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
    signals: Array<{ type: string; confidence: number; quote?: string }>;
  } | null;
  solution: {
    salvageable: "yes" | "no" | "maybe";
    reasoning: string;
    recommendations: Array<{
      signal: string;
      recommendation: string;
      nextStep: string;
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

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 24;
  if (doc.y + needed > bottomLimit) doc.addPage();
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  const left = doc.page.margins.left;
  ensureSpace(doc, 32);
  doc.moveDown(0.5);
  const y = doc.y;
  doc.rect(left, y + 1, 3, 12).fill(COLORS.violet);
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(COLORS.ink)
    .text(title, left + 10, y, { lineBreak: false });
  doc.y = y + 18;
}

// ---- builder ----------------------------------------------------------------

export async function buildSolutionReportPdf(
  input: SolutionPdfInput,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 44 });
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
  doc.y = topY + 22;
  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor(COLORS.ink)
    .text("Deal Solution Report", left, doc.y);
  doc.moveDown(0.15);
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(COLORS.muted)
    .text(`${input.deal.name} · ${input.deal.company}`, left, doc.y);
  doc.moveDown(0.4);
  doc.rect(left, doc.y, 64, 2.5).fill(COLORS.violet);
  doc.y += 14;

  // ---- Deal context + Risk band (two columns) ----
  const bandY = doc.y;
  const gap = 16;
  const boxH = 100;
  const leftW = Math.round(width * 0.56);
  const rightW = width - leftW - gap;

  // Left: deal context
  doc.roundedRect(left, bandY, leftW, boxH, 6).fill(COLORS.panel);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.violet)
    .text("DEAL CONTEXT", left + 12, bandY + 12, {
      width: leftW - 24,
      characterSpacing: 0.5,
      lineBreak: false,
    });
  let cy = bandY + 28;
  const dealRows: Array<[string, string]> = [
    ["Company", input.deal.company],
    ["Stage", formatStage(input.deal.stage)],
    ["Amount", formatCurrency(input.deal.amount, input.deal.currency)],
    ["Industry", input.deal.industry?.trim() || "—"],
  ];
  for (const [k, v] of dealRows) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(k, left + 12, cy, { width: 64, lineBreak: false });
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(COLORS.ink)
      .text(truncate(v, 42), left + 78, cy, {
        width: leftW - 90,
        lineBreak: false,
      });
    cy += 15;
  }

  // Right: risk score card
  const rx = left + leftW + gap;
  doc.roundedRect(rx, bandY, rightW, boxH, 6).fill(COLORS.panel);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.violet)
    .text("RISK", rx + 12, bandY + 12, { width: rightW - 24, lineBreak: false });
  if (input.risk) {
    const lvlColor = riskLevelColor(input.risk.level);
    doc
      .font("Helvetica-Bold")
      .fontSize(30)
      .fillColor(lvlColor)
      .text(String(input.risk.score), rx + 12, bandY + 24, {
        width: rightW - 24,
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(
        `/ 100 · ${input.risk.level.toUpperCase()} · ${input.risk.signals.length} signal${input.risk.signals.length === 1 ? "" : "s"}`,
        rx + 12,
        bandY + 60,
        { width: rightW - 24, lineBreak: false },
      );
    const barY = bandY + 78;
    const barW = rightW - 24;
    doc.roundedRect(rx + 12, barY, barW, 5, 2.5).fill(COLORS.border);
    doc
      .roundedRect(
        rx + 12,
        barY,
        Math.max(3, (barW * input.risk.score) / 100),
        5,
        2.5,
      )
      .fill(lvlColor);
  } else {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text("No risk analysis on file", rx + 12, bandY + 32, {
        width: rightW - 24,
      });
  }
  doc.y = bandY + boxH + 8;

  // ---- Analyzed call ----
  sectionTitle(doc, "Analyzed call");
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
      .fontSize(10)
      .fillColor(COLORS.ink)
      .text(input.call.title, left, doc.y, { width });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(
        `${formatDate(input.call.date)} · ${truncate(participants, 90)}${more}`,
        left,
        doc.y,
        { width },
      );
  } else {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text("No call linked to this deal.", left, doc.y, { width });
  }

  // ---- Risk signals ----
  if (input.risk && input.risk.signals.length > 0) {
    sectionTitle(doc, `Risk signals (${input.risk.signals.length})`);
    for (const s of input.risk.signals) {
      ensureSpace(doc, 34);
      const y = doc.y;
      doc.circle(left + 4, y + 5, 3).fill(confidenceColor(s.confidence));
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.ink)
        .text(formatSignal(s.type), left + 14, y, {
          width: width - 60,
          lineBreak: false,
        });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(`${Math.round(s.confidence * 100)}%`, left, y, {
          width,
          align: "right",
          lineBreak: false,
        });
      doc.y = y + 13;
      if (s.quote) {
        doc
          .font("Helvetica-Oblique")
          .fontSize(9)
          .fillColor(COLORS.muted)
          .text(`“${truncate(s.quote, 150)}”`, left + 14, doc.y, {
            width: width - 14,
          });
      }
      doc.moveDown(0.4);
    }
  }

  // ---- Solution (centerpiece) ----
  sectionTitle(doc, "Solution");
  const sv = input.solution.salvageable;
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text("Can this deal be saved?", left, doc.y, { lineBreak: false });
  doc.y += 14;
  const pillLabel = salvageableLabel(sv).toUpperCase();
  doc.font("Helvetica-Bold").fontSize(9);
  const pillW = doc.widthOfString(pillLabel) + 18;
  const pillY = doc.y;
  doc.roundedRect(left, pillY, pillW, 18, 9).fill(salvageableColor(sv));
  doc
    .fillColor(COLORS.white)
    .text(pillLabel, left + 9, pillY + 5, { lineBreak: false });
  doc.y = pillY + 24;
  if (input.solution.reasoning) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.ink)
      .text(input.solution.reasoning, left, doc.y, { width });
  }
  doc.moveDown(0.6);

  const recs = input.solution.recommendations;
  if (recs.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.success)
      .text(
        "No rescue actions needed — this deal looks healthy.",
        left,
        doc.y,
        { width },
      );
  } else {
    for (const rec of recs) {
      ensureSpace(doc, 64);
      const chip = formatSignal(rec.signal).toUpperCase();
      doc.font("Helvetica-Bold").fontSize(8);
      const chipW = doc.widthOfString(chip) + 12;
      const chipY = doc.y;
      doc.roundedRect(left, chipY, chipW, 14, 7).fill(COLORS.panel);
      doc
        .fillColor(COLORS.violet)
        .text(chip, left + 6, chipY + 3.5, { lineBreak: false });
      doc.y = chipY + 19;
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(COLORS.ink)
        .text(rec.recommendation, left, doc.y, { width });
      doc.moveDown(0.15);
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.violet)
        .text("Next step: ", left, doc.y, { continued: true });
      doc.font("Helvetica").fillColor(COLORS.ink).text(rec.nextStep);
      doc.moveDown(0.7);
    }
  }

  // ---- Footer (last page) ----
  const fy = doc.page.height - doc.page.margins.bottom + 14;
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.faint)
    .text(
      `Findr · Deal Solution Report · ${input.solution.model} · EU-hosted`,
      left,
      fy,
      { width, align: "center", lineBreak: false },
    );

  return pdfToBuffer(doc);
}
