import { Container, Section } from "../primitives";
import { Reveal } from "../Reveal";
import {
  localizedContent,
  type Locale,
} from "@/i18n/marketing-locale";

/**
 * Usability-Showcase für die Anwendungsfall-Seite /loesungen/ux-research — das
 * statische Geschwister von PersonaDeck/SessionDeck. Inszeniert die echte
 * Usability-Auswertung der App als Produkt-Shot: links die TEILNEHMER-Ansicht
 * (die Aufgabenkarte mit bewusstem Abschluss), rechts die FORSCHER-Ansicht (die
 * „Usability-Ergebnis"-Karte mit server-berechneten Verhaltensmetriken + dem
 * advisory KI-Erfolgs-Urteil).
 *
 * GROUNDING / EHRLICHKEIT (Leitprinzip: jeder Satz wörtlich wahr):
 *   • Reine Illustration, klar als „Beispiel-Auswertung" markiert — kein
 *     API-Call, kein Login, keine echten Teilnehmerdaten (wie PersonaDeck).
 *   • Dargestellt wird ausschließlich, was das Feature real tut: Aufgabenkarte +
 *     bewusster Abschluss; server-berechnete Verhaltensmetriken (Ausgang, Zeit,
 *     Klicks, Reibung aus Rage-Clicks); advisory KI-Erfolgs-Urteil gegen das
 *     Erfolgskriterium, GETRENNT vom deterministischen Verhaltens-Signal.
 *   • Rote Linie (EU AI Act, L8): NUR Verhalten — kein Affekt, keine Emotion,
 *     keine Biometrie. Das Erfolgskriterium ist forscher-seitig (erreicht den
 *     Teilnehmer nie); hier nur zur Illustration der Forscher-Ansicht gezeigt.
 *   • KEINE Statistik, kein erfundener Kunde.
 *
 * Tokens = dieselben wie die echte TaskResultCard / Aufgabenkarte, daher
 * Light/Dark-mitlaufend. Server-Komponente (keine Interaktion).
 */

type ShowcaseCopy = {
  label: string;
  participantHeading: string;
  taskLabel: string;
  taskInstruction: string;
  recorded: string;
  researcherHeading: string;
  criterionLabel: string;
  criterion: string;
  outcome: { label: string; value: string };
  time: { label: string; value: string };
  clicks: { label: string; value: string };
  friction: { label: string; value: string };
  judgeLabel: string;
  judgeVerdict: string;
  disclaimer: string;
};

const COPY: { de: ShowcaseCopy; en: ShowcaseCopy } = {
  de: {
    label: "Beispiel-Auswertung",
    participantHeading: "Was der:die Teilnehmer:in sieht",
    taskLabel: "Ihre Aufgabe",
    taskInstruction:
      "Finde in der App die Benachrichtigungs-Einstellungen und schalte die Wochen-Zusammenfassung ab.",
    recorded: "Notiert: Aufgabe geschafft ✓",
    researcherHeading: "Was du als Forscher:in bekommst",
    criterionLabel: "Erfolgskriterium",
    criterion:
      "Teilnehmer:in öffnet die Benachrichtigungs-Einstellungen und speichert die Änderung.",
    outcome: { label: "Ausgang", value: "Abgeschlossen" },
    time: { label: "Zeit pro Aufgabe", value: "73 s" },
    clicks: { label: "Klicks", value: "12" },
    friction: { label: "Reibungspunkte", value: "1" },
    judgeLabel: "KI-Einschätzung",
    judgeVerdict: "geschafft · 88 %",
    disclaimer:
      "Illustration der echten Usability-Auswertung — keine echten Teilnehmerdaten. Rein verhaltensbasiert, keine Emotions- oder Biometrieanalyse.",
  },
  en: {
    label: "Example evaluation",
    participantHeading: "What the participant sees",
    taskLabel: "Your task",
    taskInstruction:
      "Find the notification settings in the app and turn off the weekly summary.",
    recorded: "Noted: task completed ✓",
    researcherHeading: "What you get as a researcher",
    criterionLabel: "Success criterion",
    criterion:
      "Participant opens the notification settings and saves the change.",
    outcome: { label: "Outcome", value: "Completed" },
    time: { label: "Time on task", value: "73 s" },
    clicks: { label: "Clicks", value: "12" },
    friction: { label: "Friction points", value: "1" },
    judgeLabel: "AI assessment",
    judgeVerdict: "completed · 88%",
    disclaimer:
      "Illustration of the real usability evaluation — no real participant data. Purely behavioural, no emotion or biometric analysis.",
  },
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-neutral-500">{label}</dt>
      <dd className="text-body text-neutral-900">{value}</dd>
    </div>
  );
}

export function UsabilityResultShowcase({ locale }: { locale: Locale }) {
  const c = localizedContent(locale, COPY);
  return (
    <Section>
      <Container>
        <Reveal>
          <p className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-primary-600">
            <span className="h-px w-10 bg-[var(--st-line)]" />
            {c.label}
          </p>
        </Reveal>
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
          {/* Teilnehmer-Ansicht — die Aufgabenkarte mit bewusstem Abschluss */}
          <Reveal>
            <div className="flex h-full flex-col gap-3">
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-neutral-500">
                {c.participantHeading}
              </p>
              <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-5">
                <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                  {c.taskLabel}
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-neutral-900">
                  {c.taskInstruction}
                </p>
                <p className="mt-4 border-t border-neutral-100 pt-3 text-[12px] font-medium text-neutral-500">
                  {c.recorded}
                </p>
              </div>
            </div>
          </Reveal>

          {/* Forscher-Ansicht — die „Usability-Ergebnis"-Karte */}
          <Reveal delay={0.06}>
            <div className="flex h-full flex-col gap-3">
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-neutral-500">
                {c.researcherHeading}
              </p>
              <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-5">
                <p className="text-body-strong text-neutral-900">
                  Usability-Ergebnis
                </p>
                <p className="mt-2 text-caption text-neutral-500">
                  <span className="text-neutral-400">{c.criterionLabel}: </span>
                  {c.criterion}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <Metric label={c.outcome.label} value={c.outcome.value} />
                  <Metric label={c.time.label} value={c.time.value} />
                  <Metric label={c.clicks.label} value={c.clicks.value} />
                  <Metric label={c.friction.label} value={c.friction.value} />
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                  <span className="text-caption text-neutral-500">
                    {c.judgeLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-success-500/30 bg-success-50 px-2 py-0.5 text-caption font-medium text-success-700">
                    {c.judgeVerdict}
                  </span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
        <Reveal>
          <p className="mt-5 text-caption text-neutral-400">{c.disclaimer}</p>
        </Reveal>
      </Container>
    </Section>
  );
}
