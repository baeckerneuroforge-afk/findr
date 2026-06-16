/**
 * Klymeo-Markenzeichen: eine kleine Konstellation (Sternbild). Ein leuchtender
 * Kern, zu dem dünne Linien von fünf verstreuten Stern-Knoten zusammenlaufen —
 * „viele Stimmen, die zu einem gemeinsamen Kern konvergieren". Reiner Vektor,
 * keine Schrift. Größe über `className` (h-_/w-_) steuern.
 *
 * Theme-aware: `tone="brand"` (Default) speist Kern/Knoten/Linien aus der
 * bestehenden `--color-primary-*`-Rampe und folgt damit automatisch dem
 * Hell/Dunkel-Modus der Plattform (`.dark`-Wrapper der ThemeShell). `tone="onDark"`
 * trägt die hellere, leuchtende Lavendel-Variante für FEST dunkle Flächen, die
 * NICHT am .dark-Wrapper hängen (Marketing-Footer `st-on-dark`, Auth-Obsidian).
 */
type Tone = "brand" | "onDark";

const PALETTE: Record<
  Tone,
  {
    core: string;
    node: string;
    line: string;
    fine: string;
    glow: string;
    glowOpacity: number;
    spark: string;
  }
> = {
  brand: {
    core: "var(--color-primary-600)",
    node: "var(--color-primary-500)",
    line: "var(--color-primary-500)",
    fine: "var(--color-primary-400)",
    glow: "#B7ACF7",
    glowOpacity: 0.5,
    spark: "#C7C2F7",
  },
  onDark: {
    core: "#ECE9FF",
    node: "#C4B9F9",
    line: "#BBB1F4",
    fine: "#D6CFFB",
    glow: "#C9C0FF",
    glowOpacity: 0.6,
    spark: "#FFFFFF",
  },
};

export function KlymeoMark({
  className = "",
  tone = "brand",
  title,
}: {
  className?: string;
  tone?: Tone;
  /** Wenn gesetzt, wird der Mark als eigenständiges Bild angekündigt (role=img). */
  title?: string;
}) {
  const p = PALETTE[tone];
  const glowId = `klymeo-glow-${tone}`;
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={p.glow} stopOpacity={p.glowOpacity} />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="15.5" cy="16" r="11" fill={`url(#${glowId})`} />
      <g stroke={p.line} strokeWidth="0.9" strokeOpacity="0.6" strokeLinecap="round">
        <line x1="15.5" y1="16" x2="6" y2="7" />
        <line x1="15.5" y1="16" x2="26" y2="6" />
        <line x1="15.5" y1="16" x2="29" y2="17" />
        <line x1="15.5" y1="16" x2="19" y2="28" />
        <line x1="15.5" y1="16" x2="5" y2="24" />
      </g>
      <g stroke={p.fine} strokeWidth="0.7" strokeOpacity="0.5" strokeLinecap="round">
        <line x1="6" y1="7" x2="26" y2="6" />
        <line x1="26" y1="6" x2="29" y2="17" />
        <line x1="5" y1="24" x2="19" y2="28" />
      </g>
      <g fill={p.node}>
        <circle cx="6" cy="7" r="1.5" />
        <circle cx="26" cy="6" r="1.6" />
        <circle cx="29" cy="17" r="1.3" />
        <circle cx="19" cy="28" r="1.4" />
        <circle cx="5" cy="24" r="1.3" />
      </g>
      <circle cx="15.5" cy="16" r="3.3" fill={p.core} />
      <circle cx="14.6" cy="15.1" r="1.15" fill={p.spark} />
    </svg>
  );
}
