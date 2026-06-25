"use client";

import {
  USE_CASES,
  audienceLabel,
  useCaseMeta,
  type Proposal,
  type Topic,
} from "../data";
import {
  ArrowRightIcon,
  Card,
  Chip,
  GhostButton,
  PrimaryButton,
  SparkleIcon,
  TextArea,
  TextInput,
} from "../ui";

/**
 * Schritt 2 — „Dein Studienvorschlag". Verschmilzt die früher getrennten
 * Schritte Zielgruppe und Leitfaden zu EINEM Screen: oben das Wer/Wie-viele,
 * darunter der editierbare Leitfaden. Der KI-Vorschlag ist fertig vorbefüllt,
 * der Nutzer bestätigt oder justiert. Bedingtes Material (Stimulus/Aufgabe)
 * erscheint nur inline, wenn der Use-Case es braucht — nie als eigener Schritt.
 */
export function StepProposal({
  proposal,
  setProposal,
  onBack,
  onNext,
}: {
  proposal: Proposal;
  setProposal: (p: Proposal) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const meta = useCaseMeta(proposal.useCase);

  function patch(p: Partial<Proposal>) {
    setProposal({ ...proposal, ...p });
  }
  function patchTopic(id: string, t: Partial<Topic>) {
    patch({
      topics: proposal.topics.map((x) => (x.id === id ? { ...x, ...t } : x)),
    });
  }
  function removeTopic(id: string) {
    patch({ topics: proposal.topics.filter((x) => x.id !== id) });
  }
  function addTopic() {
    patch({
      topics: [
        ...proposal.topics,
        { id: `t${Date.now()}`, label: "Neues Thema", mainQuestion: "", probes: [] },
      ],
    });
  }

  return (
    <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
      <p className="inline-flex items-center gap-1.5 text-caption font-medium uppercase tracking-wide text-primary-600">
        <SparkleIcon className="h-3.5 w-3.5" /> Schritt 2 von 4 · KI-Vorschlag
      </p>
      <h1 className="mt-1 text-display text-neutral-900">Dein Studienvorschlag</h1>
      <p className="mt-2 max-w-[54ch] text-body text-neutral-500">
        Klymeo hat das aus deinem Briefing vorbereitet. Passt es so? Dann weiter —
        sonst kurz anpassen.
      </p>

      {/* Titel */}
      <div className="mt-7">
        <label className="mb-1.5 block text-small font-medium text-neutral-700">
          Titel der Studie
        </label>
        <TextInput
          value={proposal.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      {/* ── Zielgruppe ─────────────────────────────────────────────── */}
      <section className="mt-7" style={{ "--st": 1 } as React.CSSProperties}>
        <h2 className="text-h3 text-neutral-900">Zielgruppe</h2>
        <Card className="mt-2.5">
          <label className="mb-1.5 block text-small font-medium text-neutral-700">
            Wen interviewen wir?
          </label>
          <TextArea
            rows={2}
            value={proposal.persona}
            onChange={(e) => patch({ persona: e.target.value })}
          />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-small font-medium text-neutral-700">
                Anzahl Interviews
              </label>
              <TextInput
                type="number"
                min={1}
                max={1000}
                value={proposal.sampleTarget}
                onChange={(e) =>
                  patch({ sampleTarget: Number(e.target.value) || 0 })
                }
                className="max-w-[8rem]"
              />
            </div>
            <div>
              <span className="mb-1.5 block text-small font-medium text-neutral-700">
                Ansprache
              </span>
              <div className="flex gap-2">
                <Chip
                  selected={proposal.audienceType === "b2c"}
                  onSelect={() => patch({ audienceType: "b2c" })}
                >
                  {audienceLabel("b2c")}
                </Chip>
                <Chip
                  selected={proposal.audienceType === "b2b"}
                  onSelect={() => patch({ audienceType: "b2b" })}
                >
                  {audienceLabel("b2b")}
                </Chip>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <span className="mb-1.5 block text-small font-medium text-neutral-700">
              Art der Studie
            </span>
            <div className="flex flex-wrap gap-2">
              {USE_CASES.map((u) => (
                <Chip
                  key={u.id}
                  selected={proposal.useCase === u.id}
                  onSelect={() => patch({ useCase: u.id })}
                >
                  {u.label}
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 text-caption text-neutral-400">{meta.hint}</p>
          </div>

          {/* Bedingtes Material — nur wenn der Use-Case es braucht */}
          {meta.needsStimulus ? (
            <div className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-5 text-center">
              <p className="text-small font-medium text-neutral-700">
                Material für den {meta.label}
              </p>
              <p className="mt-0.5 text-caption text-neutral-400">
                Bild, Video oder Link, das die Teilnehmer:innen bewerten sollen
              </p>
              <button
                type="button"
                className="mt-3 rounded-lg border border-neutral-300 bg-card px-3 py-1.5 text-small font-medium text-neutral-600 transition-colors hover:border-neutral-400"
              >
                + Material hinzufügen
              </button>
            </div>
          ) : null}
          {meta.needsTask ? (
            <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <label className="mb-1.5 block text-small font-medium text-neutral-700">
                Aufgabe für die Teilnehmer:innen
              </label>
              <TextArea
                rows={2}
                defaultValue="Finde im Prototyp ein Rezept für heute Abend und lege es auf deine Merkliste."
              />
              <label className="mb-1.5 mt-3 block text-small font-medium text-neutral-700">
                Prototyp-Link
              </label>
              <TextInput defaultValue="https://" />
            </div>
          ) : null}
        </Card>
      </section>

      {/* ── Leitfaden ──────────────────────────────────────────────── */}
      <section className="mt-7" style={{ "--st": 2 } as React.CSSProperties}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-h3 text-neutral-900">Leitfaden</h2>
          <span className="text-caption text-neutral-400">
            {proposal.topics.length} Themen · editierbar
          </span>
        </div>

        <div className="mt-2.5 space-y-3">
          {proposal.topics.map((t, i) => (
            <Card key={t.id}>
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 font-mono text-caption text-primary-700">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <input
                    value={t.label}
                    onChange={(e) => patchTopic(t.id, { label: e.target.value })}
                    className="w-full border-0 bg-transparent p-0 text-body-strong text-neutral-900 outline-none focus:ring-0"
                  />
                  <TextArea
                    rows={2}
                    value={t.mainQuestion}
                    onChange={(e) =>
                      patchTopic(t.id, { mainQuestion: e.target.value })
                    }
                    placeholder="Leitfrage …"
                    className="mt-2 text-small"
                  />
                  {t.probes.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {t.probes.map((p, pi) => (
                        <li key={pi} className="flex items-center gap-2">
                          <span className="text-neutral-300">↳</span>
                          <input
                            value={p}
                            onChange={(e) => {
                              const probes = [...t.probes];
                              probes[pi] = e.target.value;
                              patchTopic(t.id, { probes });
                            }}
                            className="w-full rounded-md border border-transparent bg-neutral-50 px-2 py-1 text-small text-neutral-600 outline-none transition-colors hover:border-neutral-200 focus:border-primary-300 focus:bg-card"
                          />
                          <button
                            type="button"
                            aria-label="Nachfrage entfernen"
                            onClick={() =>
                              patchTopic(t.id, {
                                probes: t.probes.filter((_, x) => x !== pi),
                              })
                            }
                            className="text-neutral-300 transition-colors hover:text-neutral-600"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        patchTopic(t.id, { probes: [...t.probes, ""] })
                      }
                      className="text-caption font-medium text-primary-600 hover:text-primary-700"
                    >
                      + Nachfrage
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTopic(t.id)}
                      className="text-caption text-neutral-400 hover:text-neutral-700"
                    >
                      Thema entfernen
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <button
          type="button"
          onClick={addTopic}
          className="mt-3 w-full rounded-lg border border-dashed border-neutral-300 py-2.5 text-small font-medium text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-700"
        >
          + Thema hinzufügen
        </button>
      </section>

      <div className="mt-8 flex items-center justify-between gap-4">
        <GhostButton onClick={onBack}>Zurück</GhostButton>
        <PrimaryButton onClick={onNext}>
          Weiter <ArrowRightIcon className="h-4 w-4" />
        </PrimaryButton>
      </div>
    </div>
  );
}
