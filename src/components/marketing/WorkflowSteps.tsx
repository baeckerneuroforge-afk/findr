"use client";

import { useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/**
 * The animated "durchgehender Faden" for HomeWorkflow. When the timeline first
 * scrolls into view (framer `useInView` = IntersectionObserver, `once: true`),
 * the violet connecting line DRAWS itself left → right through the five step
 * markers, and each node's violet ring LIGHTS UP in sequence, timed to roughly
 * match the moment the line reaches it.
 *
 * Only `transform` (scaleX on the rail) and `opacity` (the node rings) animate —
 * GPU-composited, no layout thrash. The step numbers stay ink (neutral-900): the
 * violet is reserved for the structural accents (the rail + the active node
 * ring), never the number itself.
 *
 * prefers-reduced-motion is a HARD off-switch: `show` is forced true and every
 * transition is `none`, so the thread renders instantly at its final drawn state
 * with zero movement.
 */
type Step = { n: string; title: string; body: string };

// Node i sits at 10% + i·20% across the rail (which spans 10%→90%), so the
// left-anchored fill reaches it at i/4 of its travel. Matching the node-ring
// delays to that keeps light-up in lockstep with the drawing line.
const RAIL_FILL_MS = 1100;
const NODE_BASE_DELAY_MS = 120;
const NODE_STEP_DELAY_MS = 240;

export function WorkflowSteps({ steps }: { steps: Step[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // Fire once, slightly before the block is fully on-screen.
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const show = reduce || inView;

  return (
    <div ref={ref} className="relative mt-16">
      {/* Rail track — quiet neutral hairline (desktop only; the steps stack
          below lg, where the rail geometry no longer maps). */}
      <span
        aria-hidden
        className="absolute top-[26px] hidden h-px bg-neutral-200 lg:left-[10%] lg:right-[10%] lg:block"
      />
      {/* Rail fill — violet line that scales in from the left as the section
          enters. Sits under the nodes (their bg-white masks the line where it
          passes through), so the thread reads as connecting node → node. */}
      <span
        aria-hidden
        className="absolute top-[26px] hidden h-px origin-left bg-primary-600 lg:left-[10%] lg:right-[10%] lg:block"
        style={{
          transform: `scaleX(${show ? 1 : 0})`,
          transition: reduce
            ? "none"
            : `transform ${RAIL_FILL_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
      />

      <ol className="grid grid-cols-1 gap-y-10 sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-5 lg:gap-x-6">
        {steps.map((s, i) => (
          <li
            key={s.n}
            className="relative flex flex-col items-start lg:items-center lg:text-center"
          >
            {/* Node sits ON the rail: a white circle (z-10) masks the hairline
                passing through. Number is ink; the violet ring is the accent. */}
            <span className="relative z-10 inline-flex h-[52px] w-[52px] items-center justify-center rounded-full border border-neutral-200 bg-white font-marketing text-xl font-semibold tabular-nums text-neutral-900">
              {s.n}
              {/* Activation ring — violet ring fades in as the thread reaches
                  this node. Pure opacity, staggered by index. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-[-1px] rounded-full border-2 border-primary-600"
                style={{
                  opacity: show ? 1 : 0,
                  transition: reduce ? "none" : "opacity 380ms ease-out",
                  transitionDelay: reduce
                    ? undefined
                    : `${NODE_BASE_DELAY_MS + i * NODE_STEP_DELAY_MS}ms`,
                }}
              />
            </span>
            <h3 className="mt-5 text-[15px] font-semibold leading-tight text-neutral-900">
              {s.title}
            </h3>
            <p className="mt-1.5 max-w-[30ch] text-[13px] leading-relaxed text-neutral-500 lg:mx-auto">
              {s.body}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
