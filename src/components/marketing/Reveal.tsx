"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Stagger offset in seconds (use index * step for card grids). */
  delay?: number;
  /** Initial vertical offset in px. */
  y?: number;
  className?: string;
};

/**
 * Scroll-reveal wrapper: fades + lifts its children into view once.
 * Respects prefers-reduced-motion by rendering the content statically.
 */
export function Reveal({ children, delay = 0, y = 16, className }: RevealProps) {
  const reduceMotion = useReducedMotion();

  // Always render a motion.div (never swap element type) so reduced-motion
  // users can't get stuck with framer's initial opacity:0 left on a reused
  // DOM node. With reduced motion we skip the initial offset entirely.
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={reduceMotion ? undefined : { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
