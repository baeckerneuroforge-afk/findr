import { MODULES } from "../PlatformModules";
import {
  localizedContent,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";

/**
 * Laufband unter dem Hero: die vier Methoden + die beiden Werkzeuge +
 * „Eine Engine“ ziehen als endlose Spur durch (reine CSS-Animation, Inhalt
 * dupliziert für die nahtlose -50%-Schleife). prefers-reduced-motion: steht
 * still (CSS). Dekorativ — alles ist darunter als echte Inhalte erreichbar.
 */

// German copy. EN noch nicht getextet → DE-Fallback (EN=DE). Die Methoden-
// Namen kommen aus der MODULES-Registry; hier stehen nur die Marquee-eigenen
// Zusatz-Labels.
const EXTRA_ITEMS_DE = ["Voice-Agent", "Stimulus", "Eine Engine"];

export function Marquee({
  lang = MARKETING_DEFAULT_LOCALE,
}: {
  lang?: Locale;
}) {
  const extraItems = localizedContent(lang, { de: EXTRA_ITEMS_DE });
  const items = [...MODULES.map((m) => m.name), ...extraItems];
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
