// Inline SVG icons for the marketing site. All use currentColor so the parent's
// text color drives the stroke (token-agnostic). Lifted verbatim from the
// landing-comic salvage set; bold, simple geometry.
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

// DSGVO / trust — shield with a check
export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 5 6v5.5c0 4.3 2.9 7.4 7 8.5 4.1-1.1 7-4.2 7-8.5V6z" />
      <path d="M9 11.8 11 14l4-4.2" />
    </svg>
  );
}

// EU-hosted — server stack
export function ServerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="4" width="17" height="6" rx="1.5" />
      <rect x="3.5" y="14" width="17" height="6" rx="1.5" />
      <path d="M7 7h.01M7 17h.01" />
    </svg>
  );
}

// Made in Germany — map pin
export function MapPinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 21s6.5-5.2 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.8 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.4" />
    </svg>
  );
}

// EU AI Act / evidence — document with a check
export function FileCheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9.5 14.5 11 16l3.5-3.6" />
    </svg>
  );
}

// Cross-study synthesis — stacked layers
export function LayersIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 3 8l9 5 9-5z" />
      <path d="m3.5 12.5 8.5 4.7 8.5-4.7" />
    </svg>
  );
}

// Handel & E-Commerce — shopping bag
export function ShoppingBagIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}

// Tech & Consumer Apps — smartphone
export function SmartphoneIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M10.5 18.5h3" />
    </svg>
  );
}

// Disclosure caret — chevron down (rotates 180° when its panel is open)
export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Name → component map. The mega-menu / mobile accordion live in "use client"
 * islands and receive the nav registry as serializable props — a React
 * component (a function) can't cross the server→client boundary, so the registry
 * stores an icon NAME string and the client resolves it here. This is also the
 * single source the data registries (MODULES / ROLES / INDUSTRIES) reference, so
 * an icon choice is declared exactly once. Components are plain `currentColor`
 * SVGs (no hooks) → safe in both server and client trees.
 */
export const ICONS = {
  CpuIcon,
  NetworkIcon,
  RadarIcon,
  TargetIcon,
  TrendingUpIcon,
  HexagonIcon,
  CheckIcon,
  ShieldCheckIcon,
  ServerIcon,
  MapPinIcon,
  FileCheckIcon,
  LayersIcon,
  ShoppingBagIcon,
  SmartphoneIcon,
  ChevronDownIcon,
} as const;

export type IconName = keyof typeof ICONS;
