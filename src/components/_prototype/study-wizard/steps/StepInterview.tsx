"use client";

import {
  DEPTHS,
  type AnalyticsToggles,
  type Depth,
  type InterviewMode,
} from "../data";
import {
  ArrowRightIcon,
  ChatIcon,
  ChoiceCard,
  Collapsible,
  Field,
  GhostButton,
  MicIcon,
  PrimaryButton,
  TextInput,
  ToggleRow,
} from "../ui";

/**
 * Schritt 3 — Interview-Modus + Länge als KI-Empfehlung mit gesetztem Default.
 *
 * Bewusst aus der finalen Übersicht hierher verschoben (Anpassung des Nutzers):
 * die optionalen Analyse-Schalter (Visual Capture, Event-Tracking, Turn-Signals,
 * TTS) liegen EINGEKLAPPT unten, getrennt von der Kern-Entscheidung. Genauso die
 * selten gebrauchten Feineinstellungen unter „Erweitert".
 */
export function StepInterview({
  mode,
  setMode,
  depth,
  setDepth,
  language,
  setLanguage,
  maxRounds,
  setMaxRounds,
  durationMin,
  setDurationMin,
  analytics,
  setAnalytics,
  onBack,
  onNext,
}: {
  mode: InterviewMode;
  setMode: (m: InterviewMode) => void;
  depth: Depth;
  setDepth: (d: Depth) => void;
  language: "de" | "en";
  setLanguage: (l: "de" | "en") => void;
  maxRounds: number | null;
  setMaxRounds: (n: number | null) => void;
  durationMin: number | null;
  setDurationMin: (n: number | null) => void;
  analytics: AnalyticsToggles;
  setAnalytics: (a: AnalyticsToggles) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  function setTog(key: keyof AnalyticsToggles, v: boolean) {
    setAnalytics({ ...analytics, [key]: v });
  }
  const enabledCount = Object.values(analytics).filter(Boolean).length;

  return (
    <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
      <p className="text-caption font-medium uppercase tracking-wide text-primary-600">
        Schritt 3 von 4
      </p>
      <h1 className="mt-1 text-display text-neutral-900">Wie wird interviewt?</h1>
      <p className="mt-2 max-w-[52ch] text-body text-neutral-500">
        Klymeo empfiehlt das Folgende. Du kannst es so lassen oder anpassen.
      </p>

      {/* Modus */}
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          selected={mode === "text"}
          onSelect={() => setMode("text")}
          icon={<ChatIcon className="h-5 w-5 text-primary-600" />}
          title="Text-Interview"
          desc="Chat-Interview, läuft jederzeit, kein Termin nötig"
          badge={mode === "text" ? "Empfohlen" : undefined}
        />
        <ChoiceCard
          selected={mode === "voice"}
          onSelect={() => setMode("voice")}
          icon={<MicIcon className="h-5 w-5 text-primary-600" />}
          title="Voice-Interview"
          desc="Gesprochenes Interview mit KI-Stimme"
        />
      </div>

      {/* Länge / Tiefe */}
      <h2 className="mt-7 text-h3 text-neutral-900">Gesprächstiefe</h2>
      <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
        {DEPTHS.map((d) => (
          <ChoiceCard
            key={d.id}
            selected={depth === d.id}
            onSelect={() => setDepth(d.id)}
            title={d.label}
            desc={`${d.approxQuestions} · ${d.approxMinutes}`}
            badge={d.id === "mittel" ? "Empfohlen" : undefined}
          />
        ))}
      </div>

      {/* Erweitert (eingeklappt) */}
      <div className="mt-7 space-y-3">
        <Collapsible
          title="Erweitert"
          subtitle="Sprache, exaktes Zeitlimit, Experten-Override"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sprache des Interviews">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as "de" | "en")}
                className="w-full rounded-lg border border-neutral-200 bg-card px-3 py-2 text-body text-neutral-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="de">Deutsch</option>
                <option value="en">Englisch</option>
              </select>
            </Field>
            <Field label="Zeitlimit (Minuten)" hint="Leer = kein Limit">
              <TextInput
                type="number"
                min={3}
                max={60}
                value={durationMin ?? ""}
                onChange={(e) =>
                  setDurationMin(e.target.value ? Number(e.target.value) : null)
                }
                placeholder="—"
                className="max-w-[8rem]"
              />
            </Field>
            <Field
              label="Frage-Obergrenze (Override)"
              hint="Überschreibt die Tiefe-Empfehlung · leer = automatisch"
            >
              <TextInput
                type="number"
                min={2}
                max={15}
                value={maxRounds ?? ""}
                onChange={(e) =>
                  setMaxRounds(e.target.value ? Number(e.target.value) : null)
                }
                placeholder="auto"
                className="max-w-[8rem]"
              />
            </Field>
          </div>
        </Collapsible>

        {/* Optionale Analyse (eingeklappt) — hierher verschoben */}
        <Collapsible
          title="Optionale Analyse"
          subtitle={
            enabledCount > 0
              ? `${enabledCount} aktiv`
              : "Aus — nur einschalten, wenn gebraucht"
          }
        >
          <div className="divide-y divide-neutral-100">
            <ToggleRow
              checked={analytics.visualCapture}
              onChange={(v) => setTog("visualCapture", v)}
              title="Bildschirm-Aufzeichnung"
              desc="Zeichnet die Interaktion am Stimulus auf (nicht-biometrisch)"
            />
            <ToggleRow
              checked={analytics.eventTracking}
              onChange={(v) => setTog("eventTracking", v)}
              title="Verhaltens-Events"
              desc="Klicks, Scrollen, Verweildauer als Ereignisse"
            />
            <ToggleRow
              checked={analytics.turnSignals}
              onChange={(v) => setTog("turnSignals", v)}
              title="Gesprächs-Signale"
              desc="Stimmungs-Analyse des Transkripts am Sitzungsende"
            />
            <ToggleRow
              checked={analytics.tts}
              onChange={(v) => setTog("tts", v)}
              title="Vorlesen (Text-to-Speech)"
              desc="Liest Fragen im Text-Interview vor"
            />
          </div>
        </Collapsible>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <GhostButton onClick={onBack}>Zurück</GhostButton>
        <PrimaryButton onClick={onNext}>
          Weiter <ArrowRightIcon className="h-4 w-4" />
        </PrimaryButton>
      </div>
    </div>
  );
}
