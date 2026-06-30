"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Konsoul, type KonsoulState } from "@/components/dashboard/Konsoul";
import {
  isValidSuggestionValue,
  type WizardAdvisorResult,
  type WizardAdvisorSuggestion,
} from "@/lib/schemas/konsoul-wizard";
import type {
  AudienceType,
  Depth,
  UseCase,
  WizardState,
} from "./types";

/**
 * KonsoulWizardCompanion — Konsoul als Berater OBEN im Studien-Anlege-Assistenten
 * (flag-gated über NEXT_PUBLIC_KONSOUL_WIZARD_ENABLED; der Wizard mountet diese
 * Komponente nur dann). Phase 1:
 *   - ein statischer, schritt-bezogener Tipp als Default (kein Modell-Aufruf),
 *   - eine Frag-Box (Freitext → Opus beantwortet, geerdet am Formular + Portfolio),
 *   - „Was würdest du vorschlagen?" (Opus schlägt Feldwerte vor),
 *   - Vorschlags-Karten mit „Übernehmen" → schreibt via `patch()` in den State.
 *
 * Opus läuft NUR auf echte Nutzer-Aktion (Frage oder Vorschlag-Knopf), nie bei
 * jeder Eingabe. Die Vorschläge sind bereits server-seitig sanitisiert; vor dem
 * `patch()` prüft `isValidSuggestionValue` ein zweites Mal (Enum-Token), damit ein
 * kaputter Wert NIE in den Wizard-State (und damit in einen Select) gelangt.
 */

/** Mappt den Begleiter-Zustand auf eine Konsoul-Mimik. EXPORTIERT für den
 *  Ehrlichkeits-Test: das grüne „belegt"/answer-Gesicht ist hier strukturell
 *  UNERREICHBAR — ein Berater-Output ist nie „belegt", sondern Vorschlag
 *  (propose) bzw. neutrale Hilfe (guidance). Reihenfolge = Vorrang. */
export function faceStateFor(args: {
  loading: boolean;
  error: boolean;
  hasSuggestions: boolean;
  hasAnswer: boolean;
}): KonsoulState {
  if (args.loading) return "research";
  if (args.error) return "refuse";
  if (args.hasSuggestions) return "propose";
  if (args.hasAnswer) return "guidance";
  return "idle";
}

export function KonsoulWizardCompanion({
  state,
  patch,
  step,
}: {
  state: WizardState;
  patch: (p: Partial<WizardState>) => void;
  step: number;
}) {
  const t = useTranslations("research.wizard");

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<WizardAdvisorSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const tip =
    step === 0
      ? t("konsoulTipSetup")
      : step === 1
        ? t("konsoulTipGuide")
        : t("konsoulTipStart");

  function snapshot() {
    return {
      briefing: state.briefing,
      title: state.title,
      persona: state.persona,
      audienceType: state.audienceType,
      useCase: state.useCase,
      interviewDepth: state.interviewDepth,
      voiceEnabled: state.voiceEnabled,
      step,
      // Clamp auf den Schema-Cap (50): selbst wenn ein Leitfaden je >50 Themen
      // hätte, soll der Snapshot nie einen 400 werfen (Konsoul bliebe sonst
      // stumm). Heute praktisch unerreichbar — billige Härtung.
      topicCount: Math.min(state.topics.length, 50),
    };
  }

  async function ask(q?: string) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const trimmed = q?.trim();
      const res = await fetch("/api/konsoul-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wizard: snapshot(),
          question: trimmed && trimmed !== "" ? trimmed : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        result?: WizardAdvisorResult;
        error?: string;
      };
      if (res.ok && data.success && data.result) {
        setAnswer(data.result.answer);
        setSuggestions(data.result.suggestions ?? []);
      } else {
        setError(data.error ?? t("konsoulError"));
      }
    } catch {
      setError(t("konsoulError"));
    } finally {
      setLoading(false);
    }
  }

  function applySuggestion(s: WizardAdvisorSuggestion) {
    // Zweite Wand vor dem State-Setter: ein Enum-Vorschlag muss ein erlaubtes
    // Token sein (die Route sanitisiert bereits — dies ist Defense-in-Depth).
    if (!isValidSuggestionValue(s.field, s.value)) return;
    switch (s.field) {
      case "briefing":
        patch({ briefing: s.value });
        break;
      case "persona":
        patch({ persona: s.value });
        break;
      case "title":
        patch({ title: s.value });
        break;
      case "useCase":
        patch({ useCase: s.value as UseCase });
        break;
      case "audienceType":
        patch({ audienceType: s.value as AudienceType });
        break;
      case "interviewDepth":
        patch({ interviewDepth: s.value as Depth });
        break;
    }
    setSuggestions((cur) => cur.filter((x) => x !== s));
  }

  const faceState = faceStateFor({
    loading,
    error: error !== null,
    hasSuggestions: suggestions.length > 0,
    hasAnswer: answer !== null,
  });

  const prose = error ?? answer ?? tip;

  return (
    <section
      className="mb-8 rounded-xl border border-neutral-200 bg-card p-4 shadow-sm sm:p-5"
      aria-label={t("konsoulTitle")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Gesicht (dekorativ, aria-hidden in der Konsoul-Komponente) */}
        <div className="mx-auto shrink-0 sm:mx-0">
          <Konsoul state={faceState} />
        </div>

        {/* Inhalt */}
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-body-strong text-neutral-900">
              {t("konsoulTitle")}
            </h3>
            <p className="text-small text-neutral-500">{t("konsoulSubtitle")}</p>
          </div>

          <p
            className={`whitespace-pre-wrap text-small ${
              error ? "text-danger-700" : "text-neutral-700"
            }`}
            role={error ? "alert" : undefined}
          >
            {prose}
          </p>

          {suggestions.length > 0 && (
            <ul className="space-y-2">
              {suggestions.map((s, i) => (
                <li
                  key={`${s.field}-${i}`}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-small font-medium text-neutral-900">
                        {s.label}
                      </p>
                      <p className="mt-0.5 text-caption text-neutral-500">
                        {s.rationale}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-small font-medium text-white outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-500/40"
                    >
                      {t("konsoulApply")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t("konsoulAskPlaceholder")}
              aria-label={t("konsoulAskPlaceholder")}
              disabled={loading}
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-card px-3 py-2 text-small text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500/30 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-small font-medium text-white outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? t("konsoulThinking") : t("konsoulAskCta")}
            </button>
          </form>

          <button
            type="button"
            onClick={() => void ask()}
            disabled={loading}
            className="text-small font-medium text-primary-700 outline-none transition-colors hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-primary-500/30 disabled:opacity-40"
          >
            {t("konsoulSuggestCta")}
          </button>
        </div>
      </div>
    </section>
  );
}

export default KonsoulWizardCompanion;
