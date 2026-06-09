"use client";

import { useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { StatusTag } from "./primitives";
import { Reveal } from "./Reveal";

/**
 * The vertical "durchgehender Faden" for HowItWorks — the module-page sibling of
 * the homepage's WorkflowSteps. When the list first scrolls into view, the
 * violet connecting line DRAWS itself downward through the numbered nodes (each
 * segment `scaleY` from the top) and each node's violet ring LIGHTS UP in
 * sequence, timed to the drawing thread.
 *
 * Vertical (not the homepage's horizontal 5-node rail) because HowItWorks steps
 * carry phase labels, status tags and multi-line bodies — a horizontal rail
 * would distort them. The geometry mirrors the existing /preise trial timeline.
 *
 * Only `transform` (scaleY on each segment) and `opacity` (the node rings)
 * animate — GPU-composited, no layout thrash. Like WorkflowSteps, the node is a
 * white circle with an INK number (neutral-900); violet is reserved for the
 * structural accents (the drawing rail + the activation ring), never the number.
 * The step CONTENT reuses <Reveal> (same staggered slide-in + no-JS / reduced-
 * motion behaviour the page had before this timeline was added).
 *
 * prefers-reduced-motion is a HARD off-switch: `show` is forced true and every
 * transition is `none`, so the thread renders instantly at its final drawn state
 * with zero movement (and Reveal renders its children statically).
 */
export type HowStep = {
  phase?: string;
  title: string;
  body: string;
  tag?: "Live" | "Bald";
};

const RAIL_DRAW_MS = 620;
const NODE_BASE_DELAY_MS = 100;
const NODE_STEP_DELAY_MS = 220;

export function HowItWorksTimeline({ steps }: { steps: HowStep[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLOListElement>(null);
  // Fire once, slightly before the block is fully on-screen.
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const show = reduce || inView;

  return (
    <ol ref={ref} className="mt-14 flex flex-col">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const delayMs = NODE_BASE_DELAY_MS + i * NODE_STEP_DELAY_MS;
        return (
          <li key={s.title} className="relative flex gap-5 pb-10 last:pb-0">
            {/* Connector — runs from this node's bottom edge to the next node's
                top edge (the node's opaque bg masks the line where it passes).
                Track = quiet neutral hairline; fill = violet line that draws
                downward (scaleY from the top) as the thread reaches this step. */}
            {!isLast ? (
              <>
                <span
                  aria-hidden
                  className="absolute left-[17px] top-9 bottom-0 w-px bg-neutral-200"
                />
                <span
                  aria-hidden
                  className="absolute left-[17px] top-9 bottom-0 w-px origin-top bg-primary-600"
                  style={{
                    transform: `scaleY(${show ? 1 : 0})`,
                    transition: reduce
                      ? "none"
                      : `transform ${RAIL_DRAW_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                    transitionDelay: reduce ? undefined : `${delayMs}ms`,
                  }}
                />
              </>
            ) : null}

            {/* Node sits ON the rail (z-10, opaque bg masks the line). Number is
                ink; the violet activation ring fades in as the thread arrives. */}
            <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-sm font-semibold tabular-nums text-neutral-900">
              {i + 1}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-[-1px] rounded-full border-2 border-primary-600"
                style={{
                  opacity: show ? 1 : 0,
                  transition: reduce ? "none" : "opacity 380ms ease-out",
                  transitionDelay: reduce ? undefined : `${delayMs}ms`,
                }}
              />
            </span>

            {/* Step content — reuses Reveal (staggered slide-in), unchanged from
                the prior HowItWorks behaviour. */}
            <Reveal delay={delayMs / 1000} className="flex flex-col gap-1.5">
              {s.phase ? (
                <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-neutral-500">
                  {s.phase}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="font-marketing text-xl font-semibold text-neutral-900">
                  {s.title}
                </h3>
                {s.tag ? <StatusTag status={s.tag} /> : null}
              </div>
              <p className="max-w-2xl text-[15px] leading-relaxed text-neutral-500">
                {s.body}
              </p>
            </Reveal>
          </li>
        );
      })}
    </ol>
  );
}
