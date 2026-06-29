"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
  type HTMLAttributes,
  type ReactElement,
  type CSSProperties,
  type Key,
} from "react";

type Props = {
  children: ReactNode;
  step?: number;
  delay?: number;
  className?: string;
  as?: ElementType;
} & HTMLAttributes<HTMLElement>;

/**
 * Wraps a list/grid and reveals its direct children one-by-one
 * when the container scrolls into view. Subtle, professional.
 */
export function Stagger({
  children,
  step = 80,
  delay = 0,
  className = "",
  as: Tag = "div",
  ...rest
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = ref.current;
    if (!node) return;
    // Reduced motion is handled in site.css (@media reduce neutralises
    // .stagger-item), so no synchronous setState is needed here.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const items = Children.toArray(children);

  return (
    <Tag ref={ref as never} className={className} {...rest}>
      {items.map((child, i) => {
        const style: CSSProperties = { animationDelay: `${delay + i * step}ms` };
        if (isValidElement(child)) {
          const el = child as ReactElement<{ className?: string; style?: CSSProperties }>;
          const existing = el.props ?? {};
          const merged = [
            "stagger-item",
            shown ? "is-in" : "",
            existing.className ?? "",
          ]
            .filter(Boolean)
            .join(" ");
          return cloneElement(el, {
            key: (el.key as Key | null) ?? i,
            className: merged,
            style: { ...(existing.style ?? {}), ...style },
          });
        }
        return (
          <span key={i} className={`stagger-item ${shown ? "is-in" : ""}`} style={style}>
            {child}
          </span>
        );
      })}
    </Tag>
  );
}
