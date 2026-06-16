/**
 * Große, ambiente Klymeo-Konstellation für den Hero — der Mark in seiner
 * „leben­digen" Form: das ganze Sternbild dreht sich sehr langsam (st-spin),
 * die Sterne funkeln versetzt (st-twinkle). Rein dekorativ (aria-hidden),
 * reiner Vektor + CSS-Animation (kein JS). Bei prefers-reduced-motion stehen
 * Drehung und Funkeln still (Regeln in studio.css). Farben aus der Marken-
 * Indigo-Rampe (--color-primary-*), damit es sich in die Bühne einbettet.
 */
const NODES = [
  { x: 100, y: 20, r: 3.2, d: "0s", t: "4.5s" },
  { x: 160, y: 48, r: 3.6, d: "1.1s", t: "5.2s" },
  { x: 184, y: 110, r: 2.8, d: "2.3s", t: "4s" },
  { x: 150, y: 168, r: 3.2, d: "0.6s", t: "5.8s" },
  { x: 92, y: 186, r: 2.6, d: "1.8s", t: "4.8s" },
  { x: 34, y: 160, r: 3, d: "3s", t: "5.5s" },
  { x: 16, y: 96, r: 2.8, d: "0.9s", t: "4.2s" },
  { x: 44, y: 42, r: 2.4, d: "2.6s", t: "6s" },
  { x: 126, y: 118, r: 2.6, d: "1.4s", t: "3.8s" },
];

const LINKS = [
  [100, 20, 160, 48],
  [160, 48, 184, 110],
  [150, 168, 92, 186],
  [34, 160, 16, 96],
  [16, 96, 44, 42],
  [44, 42, 100, 20],
];

export function HeroConstellation({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="kly-hero-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#B7ACF7" stopOpacity="0.45" />
          <stop offset="1" stopColor="#B7ACF7" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="st-constellation-spin">
        <circle cx="100" cy="100" r="62" fill="url(#kly-hero-glow)" />
        <g
          stroke="var(--color-primary-500)"
          strokeWidth="0.8"
          strokeOpacity="0.45"
          strokeLinecap="round"
        >
          {NODES.map((n, i) => (
            <line key={i} x1="100" y1="100" x2={n.x} y2={n.y} />
          ))}
        </g>
        <g
          stroke="var(--color-primary-400)"
          strokeWidth="0.6"
          strokeOpacity="0.35"
          strokeLinecap="round"
        >
          {LINKS.map((l, i) => (
            <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} />
          ))}
        </g>
        <g fill="var(--color-primary-500)">
          {NODES.map((n, i) => (
            <circle
              key={i}
              className="st-twinkle"
              cx={n.x}
              cy={n.y}
              r={n.r}
              style={{ animationDelay: n.d, animationDuration: n.t }}
            />
          ))}
        </g>
        <circle cx="100" cy="100" r="7" fill="var(--color-primary-600)" />
        <circle cx="97.5" cy="97.5" r="2.6" fill="#D7D2FA" />
      </g>
    </svg>
  );
}
