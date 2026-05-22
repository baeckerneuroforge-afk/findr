// Inline SVG doodles for the comic pricing page (/pricing-v2): floating
// stars, sparks, squiggles and a hand-drawn pointer arrow. Purely
// decorative — callers add positioning + .doodle-* animation classes and
// an optional --rot via style. Hex colors match the approved template.
import type { CSSProperties } from "react";

type DoodleProps = {
  className?: string;
  style?: CSSProperties;
};

export function DoodleStar({ fill, className, style }: DoodleProps & { fill: string }) {
  return (
    <svg className={className} style={style} viewBox="0 0 46 46" aria-hidden>
      <path
        d="M23 3 L27 17 L41 14 L30 24 L40 35 L25 31 L23 44 L20 31 L6 34 L16 23 L5 13 L20 18 Z"
        fill={fill}
        stroke="#1a1a1a"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DoodleAsterisk({ stroke, className, style }: DoodleProps & { stroke: string }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2 L12 22 M2 12 L22 12 M5 5 L19 19 M19 5 L5 19"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DoodleSquiggle({ stroke, className, style }: DoodleProps & { stroke: string }) {
  return (
    <svg className={className} style={style} viewBox="0 0 40 22" aria-hidden>
      <path d="M2 11 Q 10 2, 18 11 T 34 11" stroke={stroke} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function DoodleDot({ fill, className, style }: DoodleProps & { fill: string }) {
  return (
    <svg className={className} style={style} viewBox="0 0 30 30" aria-hidden>
      <circle cx="15" cy="15" r="5" fill={fill} stroke="#1a1a1a" strokeWidth="2.5" />
    </svg>
  );
}

export function DoodleArrow({ className, style }: DoodleProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 90 70" aria-hidden>
      <path
        d="M6 10 C 2 34, 26 40, 40 52 M40 52 L31 46 M40 52 L34 61"
        stroke="#1a1a1a"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
