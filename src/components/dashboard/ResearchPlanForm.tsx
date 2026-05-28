"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Field,
  FIELD_INPUT_CLASS,
  FIELD_TEXTAREA_CLASS,
} from "@/components/ui/Field";
import {
  TopicEditor,
  emptyTopicDraft,
  topicDraftsToResearchTopics,
  type TopicDraft,
} from "./TopicEditor";

/**
 * Form for creating a new research plan. Spirit-spiegelt ManualDealForm:
 * use-client component, useState for form/submitting/error, inline Field
 * helpers, fetch POST to /api/research/plans, redirect to detail on success.
 *
 * KI-LEITFADEN-AFFORDANZ (zusätzlich, optional):
 *   Das Formular hat einen "Leitfaden mit KI generieren"-Block. Er ist
 *   stand-alone und ändert das normale Create-Verhalten NICHT, solange der
 *   Nutzer ihn nicht benutzt. Wenn er ihn benutzt:
 *     1. Titel + Objective müssen ausgefüllt sein.
 *     2. Form legt einen DRAFT-Plan an (POST /api/research/plans mit
 *        den aktuellen Feldern + leeren Topics).
 *     3. Mit dem frischen planId wird POST /[id]/guide aufgerufen — der
 *        Server generiert den Leitfaden + schreibt die Topics direkt in
 *        die DB.
 *     4. UI füllt den TopicEditor mit der gemappten Shape vor (label →
 *        topic, goalLink → intent, probes → hypotheses) — der Nutzer kann
 *        VOR dem finalen Speichern editieren.
 *     5. Der "Create plan"-Button wechselt zu "Save plan" und PATCH'ed
 *        den existierenden Draft (statt einen neuen anzulegen).
 *   Wenn der Nutzer die Affordanz nicht benutzt: alter Pfad, single POST.
 *
 * Der Trade-off: ein Draft wird angelegt SOBALD der Nutzer den Generator
 * benutzt — verlässt er die Seite ohne Save, bleibt der Draft als
 * 'draft'-Status in der Plan-Liste. Bewusst gewählt, weil der API-Vertrag
 * `/[id]/guide` einen planId verlangt (Auth + Ownership) und das die
 * sauberste Brücke zwischen Create-Form und planId-gebundenem Generate
 * ist.
 */

interface FormState {
  title: string;
  objective: string;
  persona: string;
  sampleTarget: string;
  topics: TopicDraft[];
}

/** Optional Generator-Inputs — leer wenn ungenutzt. */
interface GenInputs {
  segment: string;
  role: string;
  topicCount: string;
}

const INITIAL_GEN: GenInputs = { segment: "", role: "", topicCount: "" };

/** Shape returned by POST /api/research/plans/[id]/guide — kept inline
 *  here so the UI doesn't import the engine module (which is server-only).
 *  Must match InterviewGuide in src/lib/research/guide-generator.ts. */
interface GeneratedGuide {
  title: string;
  objective: string;
  estimatedMinutes: number;
  topics: Array<{
    id: string;
    label: string;
    goalLink: string;
    mainQuestion: string;
    probes: string[];
  }>;
  screeningQuestions?: string[];
}

const INITIAL_FORM: FormState = {
  title: "",
  objective: "",
  persona: "",
  sampleTarget: "",
  // Start with one empty topic so the editor isn't blank — encourages the
  // user to fill at least one in. Empty topics are dropped at submit time.
  topics: [emptyTopicDraft()],
};

export function ResearchPlanForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // KI-Generator state. `planId` flips the form into edit-mode (PATCH) once
  // a draft has been created via the generator. `lastGuide` is shown as a
  // preview block so the user sees the generated mainQuestion + probes
  // (which the TopicEditor's lossy shape doesn't expose).
  const [genInputs, setGenInputs] = useState<GenInputs>(INITIAL_GEN);
  const [planId, setPlanId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastGuide, setLastGuide] = useState<GeneratedGuide | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateGen<K extends keyof GenInputs>(key: K, value: GenInputs[K]) {
    setGenInputs((current) => ({ ...current, [key]: value }));
  }

  /** Translates the rich InterviewGuide.topics into TopicDraft[] the existing
   *  editor knows how to render. Lossy on mainQuestion (kept in lastGuide for
   *  the preview block); the agent reads label/goalLink/probes via the
   *  topic/intent/hypotheses mapping already wired in plans-service. */
  function guideTopicsToDrafts(guide: GeneratedGuide): TopicDraft[] {
    return guide.topics.map((t) => ({
      topic: t.label,
      intent: t.goalLink,
      hypotheses: t.probes,
    }));
  }

  /**
   * "Leitfaden mit KI generieren" handler. Two-stage:
   *   1. If no planId yet → create a draft plan with the current form fields
   *      (empty topics) so we have an id to attach to /[id]/guide.
   *   2. POST /api/research/plans/[id]/guide with goal (= objective) +
   *      segment/role/topicCount. Server generates + writes topics. We
   *      receive the full guide and refresh local state.
   */
  async function handleGenerate() {
    setGenError(null);
    const title = form.title.trim();
    const objective = form.objective.trim();
    if (title.length < 3) {
      setGenError(
        "Titel muss mindestens 3 Zeichen lang sein, bevor der Generator läuft.",
      );
      return;
    }
    if (objective.length < 3) {
      setGenError(
        "Objective muss mindestens 3 Zeichen lang sein — der Generator braucht es als Research-Ziel.",
      );
      return;
    }

    // Optional topicCount: empty → engine uses its default (5). Out-of-range
    // is caught client-side so the user sees a precise message.
    let topicCount: number | undefined;
    if (genInputs.topicCount.trim() !== "") {
      const parsed = Number(genInputs.topicCount);
      if (!Number.isInteger(parsed) || parsed < 3 || parsed > 10) {
        setGenError(
          "Topic-Count muss eine ganze Zahl zwischen 3 und 10 sein (oder leer für 5).",
        );
        return;
      }
      topicCount = parsed;
    }

    setGenerating(true);
    try {
      // Stage 1: ensure a draft plan exists.
      let currentPlanId = planId;
      if (!currentPlanId) {
        const createRes = await fetch("/api/research/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            objective,
            topics: [],
            persona: form.persona.trim() === "" ? null : form.persona.trim(),
            sampleTarget: null,
          }),
        });
        const createData = (await createRes.json().catch(() => ({}))) as {
          error?: string;
          planId?: string;
        };
        if (!createRes.ok || !createData.planId) {
          throw new Error(
            createData.error ??
              "Konnte den Draft-Plan für die Generierung nicht anlegen.",
          );
        }
        currentPlanId = createData.planId;
        setPlanId(currentPlanId);
      }

      // Stage 2: generate the guide on that plan.
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(currentPlanId)}/guide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: objective,
            segment:
              genInputs.segment.trim() === ""
                ? undefined
                : genInputs.segment.trim(),
            role:
              genInputs.role.trim() === "" ? undefined : genInputs.role.trim(),
            topicCount,
            language: "de",
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        guide?: GeneratedGuide;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.success || !data.guide) {
        const message =
          res.status === 404
            ? "Plan nicht gefunden."
            : res.status === 401 || res.status === 403
              ? "Kein Zugriff auf diesen Plan."
              : res.status === 400
                ? (data.error ?? "Ungültige Anfrage.")
                : (data.detail ??
                  data.error ??
                  "Leitfaden-Generierung fehlgeschlagen.");
        throw new Error(message);
      }

      // Prefill the topic editor + remember the rich guide for the preview.
      update("topics", guideTopicsToDrafts(data.guide));
      setLastGuide(data.guide);
    } catch (err) {
      setGenError(
        err instanceof Error
          ? err.message
          : "Leitfaden-Generierung fehlgeschlagen.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const title = form.title.trim();
    const objective = form.objective.trim();
    if (title.length < 3) {
      setError("Title must be at least 3 characters.");
      return;
    }
    if (objective.length < 3) {
      setError("Objective must be at least 3 characters.");
      return;
    }

    // Optional sampleTarget: empty string -> null. Non-numeric / out-of-range
    // is rejected here so the user sees a precise message instead of a
    // generic 400 from the API's Zod validation.
    let sampleTarget: number | null = null;
    if (form.sampleTarget.trim() !== "") {
      const parsed = Number(form.sampleTarget);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
        setError("Sample target must be a whole number between 1 and 1000.");
        return;
      }
      sampleTarget = parsed;
    }

    const topics = topicDraftsToResearchTopics(form.topics);

    setSubmitting(true);
    try {
      // Branch: if the generator already created a draft, PATCH it instead
      // of creating a second plan. Otherwise plain POST as before. The PATCH
      // path mirrors the existing update flow; both end on the same detail
      // redirect.
      if (planId) {
        const res = await fetch(
          `/api/research/plans/${encodeURIComponent(planId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              objective,
              topics,
              persona: form.persona.trim() === "" ? null : form.persona.trim(),
              sampleTarget,
            }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Could not save research plan.");
        }
        router.push(`/dashboard/research-plans/${planId}`);
        return;
      }

      const res = await fetch("/api/research/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          objective,
          topics,
          persona: form.persona.trim() === "" ? null : form.persona.trim(),
          sampleTarget,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        planId?: string;
      };
      if (!res.ok || !data.planId) {
        throw new Error(data.error ?? "Could not create research plan.");
      }
      // Hand off to the detail page; status starts as 'draft' there.
      router.push(`/dashboard/research-plans/${data.planId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create research plan.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-4">
        <Field label="Title" required>
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Q3 Onboarding research"
            disabled={submitting}
            className={FIELD_INPUT_CLASS}
          />
        </Field>

        <Field
          label="Objective"
          required
          hint="One sentence: what do we want to learn from this study?"
        >
          <textarea
            value={form.objective}
            onChange={(e) => update("objective", e.target.value)}
            placeholder="Understand the gap between expected and actual onboarding effort for new admin users."
            rows={3}
            disabled={submitting}
            className={FIELD_TEXTAREA_CLASS}
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Target persona"
            hint="Role, industry, maturity — free text."
          >
            <textarea
              value={form.persona}
              onChange={(e) => update("persona", e.target.value)}
              placeholder="Admin user at SMB SaaS, 5-50 seats, onboarding within the last 90 days."
              rows={2}
              disabled={submitting}
              className={FIELD_TEXTAREA_CLASS}
            />
          </Field>

          <Field
            label="Sample target"
            hint="How many completed interviews are we aiming for? Leave empty for open-ended."
          >
            <input
              value={form.sampleTarget}
              onChange={(e) => update("sampleTarget", e.target.value)}
              placeholder="10"
              inputMode="numeric"
              disabled={submitting}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
        </div>
      </section>

      {/* KI-Leitfaden-Generator — optional, ändert das Standard-Verhalten
          nicht, wenn nicht benutzt. Setzt sich VOR den Topic-Editor, damit
          das Ergebnis direkt sichtbar in die Topic-Liste darunter fließt. */}
      <section className="space-y-3 rounded-lg border border-primary-200 bg-primary-50/40 p-4">
        <div>
          <h2 className="text-h3 text-neutral-900">
            Leitfaden mit KI generieren
          </h2>
          <p className="mt-0.5 text-small text-neutral-600">
            Aus deinem Research-Ziel (Objective oben) erzeugt die KI einen
            strukturierten Interview-Leitfaden — offene, nicht-leitende
            Fragen, ≥3 Topics, mit Probes. Du kannst alles unten editieren,
            bevor du speicherst.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Segment (optional)" hint="z. B. SMB SaaS">
            <input
              value={genInputs.segment}
              onChange={(e) => updateGen("segment", e.target.value)}
              placeholder="SMB SaaS"
              disabled={generating || submitting}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
          <Field label="Rolle (optional)" hint="z. B. Admin-User">
            <input
              value={genInputs.role}
              onChange={(e) => updateGen("role", e.target.value)}
              placeholder="Admin-User"
              disabled={generating || submitting}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
          <Field label="Topic-Count" hint="leer = 5, sonst 3–10">
            <input
              value={genInputs.topicCount}
              onChange={(e) => updateGen("topicCount", e.target.value)}
              placeholder="5"
              inputMode="numeric"
              disabled={generating || submitting}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3">
          {genError ? (
            <span className="max-w-md text-caption text-danger-700">
              {genError}
            </span>
          ) : planId ? (
            <span className="text-caption text-neutral-500">
              Draft als Plan angelegt — der Save-Button speichert deine
              Editierungen darüber.
            </span>
          ) : (
            <span className="text-caption text-neutral-500">
              Generieren legt einen Draft-Plan an, damit der Leitfaden an
              ihn gebunden wird.
            </span>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={handleGenerate}
            disabled={generating || submitting}
          >
            {generating
              ? "KI generiert…"
              : planId
                ? "Leitfaden neu generieren"
                : "Leitfaden mit KI generieren"}
          </Button>
        </div>

        {/* Preview of mainQuestion + screening — TopicEditor's lossy shape
            doesn't show these, but they're the most concrete output of the
            generator. Read-only block, purely informational. */}
        {lastGuide && (
          <div className="space-y-3 border-t border-primary-200/60 pt-3">
            <p className="text-caption font-medium uppercase tracking-wider text-neutral-500">
              Generierte Hauptfragen ({lastGuide.topics.length} Topics ·{" "}
              {lastGuide.estimatedMinutes} Min)
            </p>
            <ul className="space-y-2">
              {lastGuide.topics.map((t) => (
                <li
                  key={t.id}
                  className="rounded-md border border-neutral-200 bg-white p-3"
                >
                  <p className="text-small font-medium text-neutral-900">
                    {t.label}
                  </p>
                  <p className="mt-1 text-small italic text-neutral-700">
                    „{t.mainQuestion}"
                  </p>
                </li>
              ))}
            </ul>
            {lastGuide.screeningQuestions &&
              lastGuide.screeningQuestions.length > 0 && (
                <div>
                  <p className="text-caption font-medium uppercase tracking-wider text-neutral-500">
                    Screening-Fragen (rein informativ)
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {lastGuide.screeningQuestions.map((q, i) => (
                      <li key={i} className="text-small text-neutral-700">
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">Topics</h2>
          <p className="mt-0.5 text-small text-neutral-500">
            The agent formulates questions on-the-fly from these topics — not
            a fixed question list. Each topic gets 2–4 turns in the
            conversation. Hypotheses are private steering, never read out
            loud.
          </p>
        </div>
        <TopicEditor
          topics={form.topics}
          onChange={(topics) => update("topics", topics)}
          disabled={submitting}
        />
      </section>

      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || generating}>
          {submitting
            ? planId
              ? "Speichere…"
              : "Erstelle…"
            : planId
              ? "Save plan"
              : "Create plan"}
        </Button>
        <span className="text-small text-neutral-500">
          {planId
            ? "Speichern überschreibt den vom Generator erzeugten Draft mit deinen Editierungen."
            : "New plans start as drafts — you can edit topics, activate, and add participants on the next screen."}
        </span>
      </div>
    </form>
  );
}
