import "server-only";

import PDFDocument from "pdfkit";
import type { LossReportData } from "@/lib/loss/reports";
import type { ForecastSummary } from "@/lib/forecast/service";
import { translate } from "@/i18n/messages";
import { toBcp47, type Locale } from "@/i18n/locale";

// Klymeo branding — consistent with the dashboard color polish.
const COLORS = {
  primary: "#6366f1", // indigo accent
  text: "#18181b", // near-black headings/body
  muted: "#71717a", // secondary text
  danger: "#dc2626", // critical only
  success: "#16a34a",
  border: "#e4e4e7",
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

function formatCurrency(value: number, locale: Locale): string {
  return new Intl.NumberFormat(toBcp47(locale), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatReason(reason: string): string {
  return reason.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

function contentRight(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.right;
}

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function addHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
  _locale: Locale,
): void {
  // "Klymeo" is the literal wordmark — never localized. `title`/`subtitle` are
  // resolved by the callers (already locale-aware), so the only reason this
  // helper takes `locale` is to keep chrome helpers uniformly threaded.
  void _locale;
  doc.font("Helvetica-Bold").fontSize(20).fillColor(COLORS.primary).text("Klymeo");
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(16).fillColor(COLORS.text).text(title);
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted).text(subtitle);
  doc.moveDown(0.8);
  doc
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(contentRight(doc), doc.y)
    .stroke();
  doc.moveDown(1);
}

function addFooter(doc: PDFKit.PDFDocument, locale: Locale): void {
  const y = doc.page.height - doc.page.margins.bottom + 12;
  const date = new Date().toLocaleDateString(toBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(
      translate(locale, "export.common.footer", { date }),
      doc.page.margins.left,
      y,
      { align: "center", width: contentWidth(doc), lineBreak: false },
    );
}

function sectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  _locale: Locale,
): void {
  // `title` arrives pre-localized from the callers; `locale` is threaded only
  // so every chrome helper carries it uniformly (see addHeader).
  void _locale;
  ensureSpace(doc, 40);
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text).text(title);
  doc.moveDown(0.4);
}

/** Add a page break if fewer than `needed` points remain before the footer. */
function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 20;
  if (doc.y + needed > bottomLimit) {
    doc.addPage();
  }
}

interface Column {
  label: string;
  width: number;
  align?: "left" | "right";
  color?: string;
}

/**
 * Minimal table renderer — pdfkit has no table API, so columns are positioned
 * manually. Columns are laid out left-to-right from the left margin.
 */
function renderTable(
  doc: PDFKit.PDFDocument,
  columns: Column[],
  rows: string[][],
): void {
  const left = doc.page.margins.left;
  const rowHeight = 18;

  const xFor = (index: number): number => {
    let x = left;
    for (let i = 0; i < index; i += 1) x += columns[i].width;
    return x;
  };

  // Header row
  ensureSpace(doc, rowHeight * 2);
  const headerY = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.muted);
  columns.forEach((col, i) => {
    doc.text(col.label.toUpperCase(), xFor(i), headerY, {
      width: col.width - 8,
      align: col.align ?? "left",
      lineBreak: false,
    });
  });
  doc.y = headerY + rowHeight - 4;
  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .moveTo(left, doc.y)
    .lineTo(left + columns.reduce((s, c) => s + c.width, 0), doc.y)
    .stroke();
  doc.moveDown(0.3);

  // Data rows
  doc.font("Helvetica").fontSize(10);
  for (const row of rows) {
    ensureSpace(doc, rowHeight);
    const y = doc.y;
    columns.forEach((col, i) => {
      doc.fillColor(col.color ?? COLORS.text).text(row[i] ?? "", xFor(i), y, {
        width: col.width - 8,
        align: col.align ?? "left",
        lineBreak: false,
      });
    });
    doc.y = y + rowHeight;
  }
  doc.moveDown(0.5);
}

function keyValueRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  valueColor: string = COLORS.text,
): void {
  ensureSpace(doc, 20);
  const y = doc.y;
  doc.font("Helvetica").fontSize(11).fillColor(COLORS.muted).text(label, doc.page.margins.left, y, {
    width: 220,
    lineBreak: false,
  });
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(valueColor)
    .text(value, doc.page.margins.left + 220, y, {
      width: contentWidth(doc) - 220,
      lineBreak: false,
    });
  doc.y = y + 20;
}

export async function buildLossReportPdf(
  report: LossReportData,
  orgName: string,
  locale: Locale,
): Promise<Buffer> {
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  addHeader(
    doc,
    t("export.loss.title"),
    `${orgName} · ${report.period_start} – ${report.period_end}`,
    locale,
  );

  sectionTitle(doc, t("export.loss.summary"), locale);
  keyValueRow(
    doc,
    t("export.loss.totalLostDeals"),
    String(report.total_lost_deals),
  );
  keyValueRow(
    doc,
    t("export.loss.totalLostValue"),
    formatCurrency(report.total_lost_value, locale),
    report.total_lost_value > 0 ? COLORS.danger : COLORS.text,
  );

  if (report.breakdown.length === 0) {
    doc.moveDown(1);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(COLORS.muted)
      .text(t("export.loss.emptyState"));
    addFooter(doc, locale);
    return pdfToBuffer(doc);
  }

  sectionTitle(doc, t("export.loss.breakdownByReason"), locale);
  renderTable(
    doc,
    [
      { label: t("export.loss.colReason"), width: 180 },
      { label: t("export.common.colCount"), width: 70, align: "right" },
      { label: t("export.common.colValue"), width: 140, align: "right" },
      { label: t("export.loss.colShare"), width: 70, align: "right" },
    ],
    report.breakdown.map((b) => [
      formatReason(b.reason),
      String(b.count),
      formatCurrency(b.value, locale),
      `${Math.round(b.percentage)}%`,
    ]),
  );

  if (report.top_lost_companies.length > 0) {
    sectionTitle(doc, t("export.loss.topLostOpportunities"), locale);
    renderTable(
      doc,
      [
        { label: t("export.common.colCompany"), width: 240 },
        { label: t("export.common.colValue"), width: 130, align: "right" },
        { label: t("export.loss.colReason"), width: 130, align: "right" },
      ],
      report.top_lost_companies.map((c) => [
        c.name,
        formatCurrency(c.value, locale),
        formatReason(c.reason),
      ]),
    );
  }

  const reasonsWithQuotes = report.breakdown.filter(
    (b) => b.sample_quotes.length > 0,
  );
  if (reasonsWithQuotes.length > 0) {
    sectionTitle(doc, t("export.loss.sampleEvidence"), locale);
    for (const b of reasonsWithQuotes) {
      ensureSpace(doc, 40);
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(formatReason(b.reason));
      doc.moveDown(0.2);
      for (const quote of b.sample_quotes.slice(0, 2)) {
        ensureSpace(doc, 30);
        doc
          .font("Helvetica-Oblique")
          .fontSize(9)
          .fillColor(COLORS.muted)
          .text(`“${quote}”`, {
            width: contentWidth(doc),
            indent: 10,
          });
        doc.moveDown(0.2);
      }
      doc.moveDown(0.4);
    }
  }

  addFooter(doc, locale);
  return pdfToBuffer(doc);
}

function winProbabilityColor(prob: number): string {
  if (prob >= 75) return COLORS.success;
  if (prob < 25) return COLORS.danger;
  return COLORS.text;
}

export async function buildForecastPdf(
  forecast: ForecastSummary,
  orgName: string,
  locale: Locale,
): Promise<Buffer> {
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  const generatedDate = new Date().toLocaleDateString(toBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  addHeader(
    doc,
    t("export.forecast.title"),
    `${orgName} · ${t("export.forecast.generatedOn", { date: generatedDate })}`,
    locale,
  );

  sectionTitle(doc, t("export.forecast.scenarios"), locale);
  keyValueRow(
    doc,
    t("export.forecast.bestCase"),
    formatCurrency(forecast.best_case, locale),
    COLORS.success,
  );
  keyValueRow(
    doc,
    t("export.forecast.likelyCase"),
    formatCurrency(forecast.likely_case, locale),
    COLORS.primary,
  );
  keyValueRow(
    doc,
    t("export.forecast.worstCase"),
    formatCurrency(forecast.worst_case, locale),
  );

  sectionTitle(doc, t("export.forecast.pipelineSummary"), locale);
  keyValueRow(
    doc,
    t("export.forecast.totalPipelineValue"),
    formatCurrency(forecast.total_pipeline_value, locale),
  );
  keyValueRow(
    doc,
    t("export.forecast.weightedPipelineValue"),
    formatCurrency(forecast.weighted_pipeline_value, locale),
    COLORS.primary,
  );
  keyValueRow(
    doc,
    t("export.forecast.dealsAtRiskValue"),
    formatCurrency(forecast.deals_at_risk_value, locale),
    forecast.deals_at_risk_value > 0 ? COLORS.danger : COLORS.text,
  );
  keyValueRow(
    doc,
    t("export.forecast.openDeals"),
    String(forecast.open_deal_count),
  );

  if (forecast.open_deal_count === 0) {
    doc.moveDown(1);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(COLORS.muted)
      .text(t("export.forecast.emptyState"));
    addFooter(doc, locale);
    return pdfToBuffer(doc);
  }

  if (forecast.by_stage.length > 0) {
    sectionTitle(doc, t("export.forecast.byStage"), locale);
    renderTable(
      doc,
      [
        { label: t("export.common.colStage"), width: 170 },
        { label: t("export.common.colCount"), width: 60, align: "right" },
        { label: t("export.common.colValue"), width: 140, align: "right" },
        { label: t("export.common.colWeighted"), width: 90, align: "right" },
      ],
      forecast.by_stage.map((s) => [
        STAGE_LABELS[s.stage] ?? formatReason(String(s.stage)),
        String(s.count),
        formatCurrency(s.value, locale),
        formatCurrency(s.weighted, locale),
      ]),
    );
  }

  const topDeals = forecast.forecasts.slice(0, 10);
  if (topDeals.length > 0) {
    sectionTitle(doc, t("export.forecast.topDealsByWeightedValue"), locale);
    renderTable(
      doc,
      [
        { label: t("export.forecast.colDeal"), width: 170 },
        { label: t("export.common.colStage"), width: 90 },
        { label: t("export.forecast.colAmount"), width: 90, align: "right" },
        { label: t("export.forecast.colWinPct"), width: 50, align: "right" },
        { label: t("export.common.colWeighted"), width: 70, align: "right" },
      ],
      topDeals.map((d) => [
        d.deal_name,
        STAGE_LABELS[d.stage] ?? formatReason(String(d.stage)),
        formatCurrency(d.amount, locale),
        `${Math.round(d.win_probability)}%`,
        formatCurrency(d.weighted_value, locale),
      ]),
    );

    // Win-probability legend with colors (kept simple — colors applied to the
    // legend dots, table cells stay neutral for print legibility).
    doc.moveDown(0.2);
    const legendY = doc.y;
    const legend: Array<{ label: string; color: string }> = [
      {
        label: t("export.forecast.legendLikely"),
        color: winProbabilityColor(80),
      },
      {
        label: t("export.forecast.legendAtRisk"),
        color: winProbabilityColor(10),
      },
    ];
    let lx = doc.page.margins.left;
    doc.font("Helvetica").fontSize(8);
    for (const item of legend) {
      doc.circle(lx + 3, legendY + 4, 3).fill(item.color);
      doc.fillColor(COLORS.muted).text(item.label, lx + 12, legendY, {
        lineBreak: false,
        width: 120,
      });
      lx += 140;
    }
    doc.y = legendY + 16;
  }

  addFooter(doc, locale);
  return pdfToBuffer(doc);
}
