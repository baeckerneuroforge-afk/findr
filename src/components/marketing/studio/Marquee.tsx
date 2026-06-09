import { MODULES } from "../PlatformModules";

/**
 * Laufband unter dem Hero: die vier Methoden + „Eine Engine“ ziehen als
 * endlose Spur durch (reine CSS-Animation, Inhalt dupliziert für die
 * nahtlose -50%-Schleife). prefers-reduced-motion: steht still (CSS).
 * Dekorativ — die Methoden sind direkt darunter als echte Links erreichbar.
 */
export function Marquee() {
  const items = [...MODULES.map((m) => m.name), "Eine Engine"];
  return (
    <div className="st-marquee" aria-hidden>
      <div className="st-marquee-track">
        {[0, 1].map((dup) => (
          <span key={dup} className="contents">
            {items.map((label) => (
              <span key={`${dup}-${label}`}>{label}</span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
