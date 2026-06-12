"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toBcp47 } from "@/i18n/locale";

interface RiskScorePoint {
  date: string;
  score: number;
  level: "low" | "medium" | "high" | "critical";
}

interface RiskHistoryChartProps {
  history: RiskScorePoint[];
  /** Heading above the chart. Defaults to the risk framing (deal page). */
  title?: string;
  /** When true, an upward trend is good (green). Health uses this; risk doesn't. */
  higherIsBetter?: boolean;
  /** Dashed reference line value (0-100), or null to hide it. Defaults to 70. */
  thresholdValue?: number | null;
}

const LEVEL_COLORS = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

export function RiskHistoryChart({
  history,
  title,
  higherIsBetter = false,
  thresholdValue = 70,
}: RiskHistoryChartProps) {
  const t = useTranslations("sales.deal");
  const locale = useLocale();
  const resolvedTitle = title ?? t("chartTitle");
  const chartData = useMemo(() => {
    const sorted = [...history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const width = 800;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const xStep = sorted.length > 1 ? innerWidth / (sorted.length - 1) : 0;

    const points = sorted.map((point, i) => ({
      ...point,
      x: padding.left + i * xStep,
      y: padding.top + innerHeight - (point.score / 100) * innerHeight,
    }));

    const pathD = points
      .map((point, i) => `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    return { width, height, padding, innerWidth, innerHeight, points, pathD };
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 bg-card p-8 text-center text-body text-neutral-500">
        {t("chartNoHistory")}
      </div>
    );
  }

  if (history.length === 1) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 bg-card p-8 text-center text-body text-neutral-500">
        {t("chartOnePoint")}
      </div>
    );
  }

  const latest = chartData.points[chartData.points.length - 1];
  const earliest = chartData.points[0];
  const trend = latest.score - earliest.score;
  const trendLabel = trend > 0 ? `+${trend}` : `${trend}`;
  const xAxisLabels =
    chartData.points.length > 2
      ? [
          chartData.points[0],
          chartData.points[Math.floor(chartData.points.length / 2)],
          chartData.points[chartData.points.length - 1],
        ]
      : chartData.points;
  const worsening = higherIsBetter ? trend < 0 : trend > 0;
  const improving = higherIsBetter ? trend > 0 : trend < 0;
  const trendColor = worsening
    ? "text-danger-700"
    : improving
      ? "text-success-700"
      : "text-neutral-500";

  return (
    <div className="rounded-lg border border-neutral-200 bg-card p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-h2 text-neutral-900">{resolvedTitle}</h3>
          <p className="mt-1 text-small text-neutral-500">
            {t.rich("chartTrend", {
              count: chartData.points.length,
              trend: trendLabel,
              b: (chunks) => <span className={trendColor}>{chunks}</span>,
            })}
          </p>
        </div>
        <div className="text-right">
          <div className="text-display text-neutral-900">{latest.score}</div>
          <div className="text-caption text-neutral-500 uppercase tracking-wider">
            {t("chartCurrent")}
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${chartData.width} ${chartData.height}`}
        className="w-full"
        role="img"
        aria-label={t("chartAria", { title: resolvedTitle })}
      >
        {[0, 25, 50, 75, 100].map((value) => {
          const y =
            chartData.padding.top +
            chartData.innerHeight -
            (value / 100) * chartData.innerHeight;

          return (
            <g key={value}>
              <line
                x1={chartData.padding.left}
                y1={y}
                x2={chartData.width - chartData.padding.right}
                y2={y}
                className="stroke-neutral-200"
                strokeWidth="1"
              />
              <text
                x={chartData.padding.left - 8}
                y={y + 4}
                className="fill-neutral-400"
                fontSize="10"
                textAnchor="end"
              >
                {value}
              </text>
            </g>
          );
        })}

        {thresholdValue !== null && (
          <line
            x1={chartData.padding.left}
            y1={
              chartData.padding.top +
              chartData.innerHeight -
              (thresholdValue / 100) * chartData.innerHeight
            }
            x2={chartData.width - chartData.padding.right}
            y2={
              chartData.padding.top +
              chartData.innerHeight -
              (thresholdValue / 100) * chartData.innerHeight
            }
            stroke="#ef4444"
            strokeWidth="1"
            strokeDasharray="4,4"
            opacity="0.35"
          />
        )}

        <path
          d={chartData.pathD}
          fill="none"
          className="stroke-primary-600"
          strokeWidth="2"
        />

        {chartData.points.map((point) => (
          <g key={`${point.date}-${point.score}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill={LEVEL_COLORS[point.level]}
              className="stroke-card"
              strokeWidth="2"
            />
            <title>
              {new Date(point.date).toLocaleDateString(toBcp47(locale))} ·{" "}
              {point.score}/100 ({point.level})
            </title>
          </g>
        ))}

        {xAxisLabels.map((point, i, labels) => (
          <text
            key={`${point.date}-${i}`}
            x={point.x}
            y={chartData.height - 8}
            className="fill-neutral-500"
            fontSize="10"
            textAnchor={
              i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"
            }
          >
            {new Date(point.date).toLocaleDateString(toBcp47(locale), {
              day: "2-digit",
              month: "short",
            })}
          </text>
        ))}
      </svg>
    </div>
  );
}
