"use client";

import { useMemo } from "react";

interface RiskScorePoint {
  date: string;
  score: number;
  level: "low" | "medium" | "high" | "critical";
}

interface RiskHistoryChartProps {
  history: RiskScorePoint[];
}

const LEVEL_COLORS = {
  low: "#10b981",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

export function RiskHistoryChart({ history }: RiskHistoryChartProps) {
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
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-mist/50">
        No history yet. Risk scores are tracked over time once daily analysis runs.
      </div>
    );
  }

  if (history.length === 1) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-mist/50">
        Only one data point so far. The chart will appear after the next analysis.
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
  const trendColor =
    trend > 0
      ? "text-red-400"
      : trend < 0
        ? "text-emerald-400"
        : "text-mist/50";

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div>
          <h3 className="text-white font-semibold text-sm">
            Risk Score Over Time
          </h3>
          <p className="text-xs text-mist/50 mt-1">
            {chartData.points.length} data points - Trend{" "}
            <span className={trendColor}>{trendLabel} points</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{latest.score}</div>
          <div className="text-xs text-mist/50">current</div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${chartData.width} ${chartData.height}`}
        className="w-full"
        role="img"
        aria-label="Risk score history chart"
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
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
              <text
                x={chartData.padding.left - 8}
                y={y + 4}
                fill="rgba(255,255,255,0.3)"
                fontSize="10"
                textAnchor="end"
              >
                {value}
              </text>
            </g>
          );
        })}

        <line
          x1={chartData.padding.left}
          y1={
            chartData.padding.top +
            chartData.innerHeight -
            (70 / 100) * chartData.innerHeight
          }
          x2={chartData.width - chartData.padding.right}
          y2={
            chartData.padding.top +
            chartData.innerHeight -
            (70 / 100) * chartData.innerHeight
          }
          stroke="#ef4444"
          strokeWidth="1"
          strokeDasharray="4,4"
          opacity="0.4"
        />

        <path
          d={chartData.pathD}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="2"
        />

        {chartData.points.map((point) => (
          <g key={`${point.date}-${point.score}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill={LEVEL_COLORS[point.level]}
              stroke="#0a0a1f"
              strokeWidth="2"
            />
            <title>
              {new Date(point.date).toLocaleDateString("de-DE")} -{" "}
              {point.score}/100 ({point.level})
            </title>
          </g>
        ))}

        {xAxisLabels.map((point, i, labels) => (
          <text
            key={`${point.date}-${i}`}
            x={point.x}
            y={chartData.height - 8}
            fill="rgba(255,255,255,0.4)"
            fontSize="10"
            textAnchor={
              i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"
            }
          >
            {new Date(point.date).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "short",
            })}
          </text>
        ))}
      </svg>
    </div>
  );
}
