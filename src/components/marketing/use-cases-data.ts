import { getModules, type ModuleEntry } from "./PlatformModules";
import type { IconName } from "./icons";
import {
  localizedContent,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";

/**
 * Die ANWENDUNGSFÄLLE (Use Cases) — die übergeordnete „Dafür nutzt du
 * Klymeo"-Ebene, nach Outset-Modell: EINE Engine, darunter ein flaches
 * Use-Case-Grid. Use Cases dürfen sich überlappen und dürfen Outputs sein
 * (anders als eine strikte Methoden-Taxonomie) — das löst das Abgrenzungs-
 * problem zwischen Marktforschung, User Research und Personas.
 *
 * Single source für das Homepage-Grid (studio/UseCaseDeck), das Header-Mega-
 * Menü, den Footer und die Sitemap — alle lesen aus dieser Registry, damit
 * Label, Tagline, Icon und Route nie driften.
 *
 * STATUS / EHRLICHKEIT (Leitprinzip: jeder Satz muss heute wörtlich wahr sein):
 *   • "live"     → voll nutzbar heute, bekommt eine /loesungen-Seite und steht
 *                  in Nav/Footer/Sitemap.
 *   • "prepared" → als Use-Case VORGESEHEN, aber heute NICHT nutzbar. Wird im
 *                  Homepage-Grid nur als deaktiviertes Element gezeigt (kein
 *                  Link, "In Vorbereitung"), bekommt KEINE Seite und steht NICHT
 *                  in Nav/Footer/Sitemap. Ein späterer Flip auf "live" + eine
 *                  Seite aktiviert es — ohne Behauptung, dass es heute geht.
 *
 * `slug`/`icon`/`status`/`methodSlugs` sind locale-INVARIANT; nur `name` +
 * `tagline` tragen ein bilinguales `{ de, en }`-Paar. `getUseCases(locale)`
 * löst sie zu einem flachen `UseCaseRef[]` auf (der `de`-Zweig liefert die
 * Originalstrings verbatim).
 */

export type UseCaseStatus = "live" | "prepared";

export type UseCaseRef = {
  slug: string;
  name: string;
  tagline: string;
  icon: IconName;
  status: UseCaseStatus;
  /** Marktforschung referenziert die vier bestehenden Methoden per Slug —
   *  NICHT dupliziert; aufgelöst über getUseCaseMethods(getModules). */
  methodSlugs?: string[];
};

type UseCaseData = Omit<UseCaseRef, "name" | "tagline"> & {
  name: { de: string; en: string };
  tagline: { de: string; en: string };
};

const USE_CASE_DATA: UseCaseData[] = [
  {
    slug: "marktforschung",
    name: { de: "Marktforschung", en: "Market Research" },
    tagline: {
      de: "Was will dein Markt? Bedarf, Marke, Konzept und Creative — belegt am Gespräch, nicht aus Hypothesen abgeleitet.",
      en: "What does your market want? Needs, brand, concept and creative — evidenced in the conversation, not derived from hypotheses.",
    },
    icon: "LayersIcon",
    status: "live",
    methodSlugs: [
      "bedarf-verhalten",
      "markenwahrnehmung",
      "konzept-test",
      "creative-test",
    ],
  },
  {
    slug: "user-research",
    name: { de: "User Research", en: "User Research" },
    tagline: {
      de: "Wer sind deine Nutzer:innen — und warum handeln sie so? Discovery-Tiefeninterviews auf derselben Engine, bevor du baust.",
      en: "Who are your users — and why do they behave the way they do? Discovery in-depth interviews on the same engine, before you build.",
    },
    icon: "UsersIcon",
    status: "live",
  },
  {
    // LIVE: die Usability-Schleife ist gebaut + deployt (Aufgabe + Verhaltens-
    // Event-Store + KI-Erfolgs-Urteil + Usability-Metriken) → eigene
    // /loesungen/ux-research-Seite, rein über status verdrahtet (Nav/Footer/
    // Sitemap/Cross-Grid ziehen automatisch nach).
    slug: "ux-research",
    name: { de: "UX Research", en: "UX Research" },
    tagline: {
      de: "Schaffen Menschen die Aufgabe? Task-basiertes Usability-Testing mit Verhaltenssignalen — belegt, nicht vermutet.",
      en: "Can people complete the task? Task-based usability testing with behavioural signals — evidenced, not assumed.",
    },
    icon: "TargetIcon",
    status: "live",
  },
  {
    // LIVE: die Persona-Stufe ist gebaut und deployt (Engine
    // audience-personas.ts, POST /personas, Dashboard-Sub-Route) → bekommt eine
    // eigene /loesungen/personas-Seite und steht in Nav/Footer/Sitemap. Wie die
    // anderen Live-Fälle rein über `status` verdrahtet — getLiveUseCases filtert,
    // also ziehen Mega-Menü, Footer, Sitemap und Cross-Verweis-Grid automatisch
    // nach; das Homepage-Grid rendert die Karte dadurch klickbar.
    slug: "personas",
    name: { de: "Personas", en: "Personas" },
    tagline: {
      de: "Belegte Personas, verdichtet aus echten Interviews statt erfunden.",
      en: "Evidenced personas, distilled from real interviews rather than invented.",
    },
    icon: "IdCardIcon",
    status: "live",
  },
];

/** Kanonische Use-Case-Route — an EINER Stelle deklariert. */
export function getUseCaseHref(slug: string): string {
  return `/loesungen/${slug}`;
}

/** Alle Use Cases (inkl. "prepared") für eine Locale. `de` verbatim. */
export function getUseCases(locale: Locale): UseCaseRef[] {
  return USE_CASE_DATA.map((u) => ({
    slug: u.slug,
    name: localizedContent(locale, u.name),
    tagline: localizedContent(locale, u.tagline),
    icon: u.icon,
    status: u.status,
    methodSlugs: u.methodSlugs,
  }));
}

/** Nur die LIVE Use Cases — die einzigen mit Seite, Nav, Footer und Sitemap. */
export function getLiveUseCases(locale: Locale): UseCaseRef[] {
  return getUseCases(locale).filter((u) => u.status === "live");
}

/** Die referenzierten Methoden eines Use-Cases (Marktforschung), direkt aus der
 *  MODULES-Registry aufgelöst — Name/Blurb/Href/Icon können nie driften. */
export function getUseCaseMethods(
  locale: Locale,
  slug: string,
): ModuleEntry[] {
  const uc = USE_CASE_DATA.find((u) => u.slug === slug);
  if (!uc?.methodSlugs) return [];
  const wanted = new Set(uc.methodSlugs);
  return getModules(locale).filter((m) =>
    wanted.has(m.href.replace("/methoden/", "")),
  );
}

/** Back-compat DE-Export (Importer ohne Locale bekommen Deutsch). */
export const USE_CASES: UseCaseRef[] = getUseCases(MARKETING_DEFAULT_LOCALE);
export const LIVE_USE_CASES: UseCaseRef[] = getLiveUseCases(
  MARKETING_DEFAULT_LOCALE,
);
