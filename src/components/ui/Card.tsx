import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> &
  // `interactive` is PURELY a visual treatment (cursor + hover-lift/press) — it
  // adds NO keyboard/ARIA semantics and is not a focusable control. For real
  // interactivity, consumers must wrap this Card in a genuine <button>/<a> (or
  // pass role/tabIndex/handlers themselves); `interactive` only styles the
  // hover/press so it must not be mistaken for an accessible button.
  { interactive?: boolean }) {
  // Repo definiert nur --shadow-card (kein --shadow-2): für den Hover-Pop wird
  // daher das vorhandene shadow-md genutzt statt einer fehlenden Variable.
  // Statische Cards (interactive=false) erhalten exakt die alte Klassenkette.
  const interactiveClasses = interactive
    ? " cursor-pointer transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-neutral-300 active:translate-y-0 motion-reduce:transform-none"
    : "";
  return (
    <div
      className={`bg-card border border-neutral-200 rounded-card shadow-card${interactiveClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-5 py-4 border-b border-neutral-200 ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export default Card;
