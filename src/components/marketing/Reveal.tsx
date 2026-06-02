"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Stagger offset in seconds (use index * step for card grids). */
  delay?: number;
  /** Initial vertical offset in px (slide up). Set 0 for a pure opacity fade. */
  y?: number;
  /** Initial horizontal offset in px (slide from left when positive). */
  x?: number;
  className?: string;
};

/**
 * Scroll-reveal wrapper: fades + slides its children into view once, the first
 * time they cross into the viewport (framer's whileInView = IntersectionObserver
 * under the hood, `once: true` → fires a single time, no scroll-jank). Only
 * `opacity` + `transform` animate (GPU-friendly, no layout thrash).
 *
 * prefers-reduced-motion: rendered statically at its final state — `initial:
 * false` means no opacity:0 / offset is ever applied, so the content is fully
 * visible and motionless. This is the hard off-switch the whole marketing
 * surface relies on.
 *
 * Stagger a card group by giving each card `delay={i * 0.06}` (and usually
 * `y={0}` so a hairline grid's tiles fade in place without exposing the grid
 * lines mid-transform).
 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  x = 0,
  className,
}: RevealProps) {
  const reduceMotion = useReducedMotion();

  // Always render a motion.div (never swap element type) so reduced-motion
  // users can't get stuck with framer's initial opacity:0 left on a reused
  // DOM node. With reduced motion we skip the initial offset entirely.
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y, x }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={reduceMotion ? undefined : { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
