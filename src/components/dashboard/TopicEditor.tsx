"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import type { ResearchTopic } from "@/lib/voice-agent/interviewer";
import { Button } from "@/components/ui/Button";
import { FIELD_INPUT_CLASS, FIELD_TEXTAREA_CLASS } from "@/components/ui/Field";

/**
 * Dynamic-array editor for ResearchTopic[]. Each topic carries:
 *   - topic   (short label, required)
 *   - intent  (what we want to learn, required)
 *   - hypotheses[] (private steering for the agent, optional)
 *
 * The editor accepts/yields the canonical ResearchTopic shape — but uses an
 * internal TopicDraft for the open form (hypotheses are kept as a single
 * string array; empty strings filter out at save time, not on every keystroke,
 * so the user can press Enter to add a row without losing focus).
 *
 * Designed to compose: parent owns state, this component just edits it. The
 * parent decides when to validate / persist. Empty topics (both topic +
 * intent blank) are filtered at the boundary — see `withTopicValidation`
 * helper below for the canonical pre-submit filter.
 */

export interface TopicEditorProps {
  topics: TopicDraft[];
  onChange: (topics: TopicDraft[]) => void;
  disabled?: boolean;
}

/** Looser shape than ResearchTopic: hypotheses always an array (possibly
 *  empty), so the input rendering is uniform. Convert to ResearchTopic at
 *  the boundary via `topicDraftsToResearchTopics`. */
export interface TopicDraft {
  topic: string;
  intent: string;
  hypotheses: string[];
}

export function emptyTopicDraft(): TopicDraft {
  return { topic: "", intent: "", hypotheses: [] };
}

/**
 * Pre-submit filter: drop entries where BOTH topic and intent are empty
 * (the row was added but never filled in); for the rest, trim and drop
 * empty hypotheses. Mirrors the lenient server-side coerceTopics, but
 * runs client-side so the API gets the cleaned shape immediately.
 */
export function topicDraftsToResearchTopics(
  drafts: TopicDraft[],
): ResearchTopic[] {
  const out: ResearchTopic[] = [];
  for (const d of drafts) {
    const topic = d.topic.trim();
    const intent = d.intent.trim();
    if (!topic && !intent) continue;
    const hyps = d.hypotheses
      .map((h) => h.trim())
      .filter((h): h is string => h.length > 0);
    out.push(hyps.length > 0 ? { topic, intent, hypotheses: hyps } : { topic, intent });
  }
  return out;
}

/** Inverse direction — turn an existing ResearchTopic[] into editable drafts.
 *  Hypotheses default to an empty array so the rendering is consistent. */
export function researchTopicsToDrafts(topics: ResearchTopic[]): TopicDraft[] {
  return topics.map((t) => ({
    topic: t.topic,
    intent: t.intent,
    hypotheses: t.hypotheses ?? [],
  }));
}

export function TopicEditor({
  topics,
  onChange,
  disabled = false,
}: TopicEditorProps) {
  const t = useTranslations("research.plans");
  const tc = useTranslations("research.common");
  const update = useCallback(
    (index: number, patch: Partial<TopicDraft>) => {
      onChange(
        topics.map((t, i) => (i === index ? { ...t, ...patch } : t)),
      );
    },
    [topics, onChange],
  );

  const remove = useCallback(
    (index: number) => {
      onChange(topics.filter((_, i) => i !== index));
    },
    [topics, onChange],
  );

  const addTopic = useCallback(() => {
    onChange([...topics, emptyTopicDraft()]);
  }, [topics, onChange]);

  const addHypothesis = useCallback(
    (topicIndex: number) => {
      update(topicIndex, {
        hypotheses: [...topics[topicIndex].hypotheses, ""],
      });
    },
    [topics, update],
  );

  const updateHypothesis = useCallback(
    (topicIndex: number, hypIndex: number, value: string) => {
      const next = topics[topicIndex].hypotheses.map((h, i) =>
        i === hypIndex ? value : h,
      );
      update(topicIndex, { hypotheses: next });
    },
    [topics, update],
  );

  const removeHypothesis = useCallback(
    (topicIndex: number, hypIndex: number) => {
      update(topicIndex, {
        hypotheses: topics[topicIndex].hypotheses.filter(
          (_, i) => i !== hypIndex,
        ),
      });
    },
    [topics, update],
  );

  return (
    <div className="space-y-4">
      {topics.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-small text-neutral-500">
          {t("noTopicsEditor")}
        </p>
      ) : (
        <ul className="space-y-4">
          {topics.map((topic, i) => (
            <li
              key={i}
              className="rounded-lg border border-neutral-200 bg-card p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                  {t("topicN", { n: i + 1 })}
                </span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={disabled}
                  className="text-caption text-neutral-500 transition-colors hover:text-danger-700 disabled:opacity-50"
                >
                  {tc("remove")}
                </button>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-small font-medium text-neutral-700">
                    {t("topicLabel")}
                  </span>
                  <input
                    value={topic.topic}
                    onChange={(e) => update(i, { topic: e.target.value })}
                    placeholder={t("phTopicLabel")}
                    disabled={disabled}
                    className={FIELD_INPUT_CLASS}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-small font-medium text-neutral-700">
                    {t("intentLabel")}
                  </span>
                  <textarea
                    value={topic.intent}
                    onChange={(e) => update(i, { intent: e.target.value })}
                    placeholder={t("phIntent")}
                    rows={2}
                    disabled={disabled}
                    className={FIELD_TEXTAREA_CLASS}
                  />
                </label>

                <div>
                  <span className="mb-1.5 block text-small font-medium text-neutral-700">
                    {t("privateHyps")}{" "}
                    <span className="font-normal text-neutral-500">
                      {t("privateHypsHint")}
                    </span>
                  </span>
                  {topic.hypotheses.length === 0 ? (
                    <p className="text-caption text-neutral-500">
                      {t("hypsNone")}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {topic.hypotheses.map((h, hi) => (
                        <li key={hi} className="flex items-center gap-2">
                          <input
                            value={h}
                            onChange={(e) =>
                              updateHypothesis(i, hi, e.target.value)
                            }
                            placeholder={t("phHypothesis")}
                            disabled={disabled}
                            className={FIELD_INPUT_CLASS}
                          />
                          <button
                            type="button"
                            onClick={() => removeHypothesis(i, hi)}
                            disabled={disabled}
                            className="text-caption text-neutral-500 transition-colors hover:text-danger-700 disabled:opacity-50"
                          >
                            {tc("remove")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => addHypothesis(i)}
                    disabled={disabled}
                    className="mt-2 text-caption text-primary-700 transition-colors hover:text-primary-900 disabled:opacity-50"
                  >
                    {t("addHypothesis")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="secondary"
        onClick={addTopic}
        disabled={disabled}
      >
        {t("addTopic")}
      </Button>
    </div>
  );
}
