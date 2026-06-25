import type { ReactNode } from "react";

import type { ResearchPlanUseCase } from "@/lib/research/db";

interface TagProps {
  /** Dot colour. Take a CSS colour string (e.g. a `var(--color-tag-*)` token). */
  color: string;
  children: ReactNode;
  className?: string;
}

/**
 * Notion-style category tag: a small muted colour dot + a neutral label.
 * Colour lives in the data — the dot colour is passed in (no build-time token
 * dependency), so the chrome stays monochrome while categories carry the hue.
 */
export function Tag({ color, children, className = "" }: TagProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-small text-neutral-600 ${className}`}
    >
      <span
        className="h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: color }}
      />
      {children}
    </span>
  );
}

/**
 * Study use-case → tag-dot colour token. Keys are the canonical
 * `ResearchPlanUseCase` literals (src/lib/research/db.ts); values reference the
 * `--color-tag-*` palette tokens defined in globals.css.
 */
export const STUDY_TAG_COLORS: Record<ResearchPlanUseCase, string> = {
  concept_test: "var(--color-tag-indigo)",
  general_survey: "var(--color-tag-slate)",
  brand_research: "var(--color-tag-violet)",
  creative_test: "var(--color-tag-rose)",
  usability_test: "var(--color-tag-amber)",
};

export default Tag;
