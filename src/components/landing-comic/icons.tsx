// Inline SVG icons for the comic landing (/v2). Bold, simple geometry to
// match the neobrutalist look. All use currentColor so the parent chip's
// text color (white on a colored fill, or ink on yellow) drives the stroke.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

// AI Engine — processor chip
export function CpuIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M10 3v2M14 3v2M10 19v2M14 19v2M3 10h2M3 14h2M19 10h2M19 14h2" />
    </svg>
  );
}

// Knowledge Graph — connected nodes
export function NetworkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <path d="M10.4 6.9 6.6 16M13.6 6.9 17.4 16M7.5 18h9" />
    </svg>
  );
}

// Pattern Engine — radar sweep
export function RadarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19.07 4.93A10 10 0 1 0 21 9" />
      <path d="M16 7.5A6 6 0 1 0 17.5 10" />
      <path d="M12 12 19 5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Calibrates to you — target
export function TargetIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Sharper with every deal — trending up
export function TrendingUpIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 17 10 10l4 4 7-7" />
      <path d="M15 4h6v6" />
    </svg>
  );
}

// Yours alone — hexagon
export function HexagonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" />
    </svg>
  );
}

// Deliver-list bullet
export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12.5 9 17.5 20 6.5" />
    </svg>
  );
}
