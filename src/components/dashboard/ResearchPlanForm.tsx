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
 * Designed for the /dashboard/research-plans/new page. Could be reused on a
 * future "edit plan" page (the API supports PATCH); for now it's create-only,
 * and the detail page renders topics read-only until the Edit modal lands
 * (Etappe B).
 */

interface FormState {
  title: string;
  objective: string;
  persona: string;
  sampleTarget: string;
  topics: TopicDraft[];
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

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create plan"}
        </Button>
        <span className="text-small text-neutral-500">
          New plans start as drafts — you can edit topics, activate, and add
          participants on the next screen.
        </span>
      </div>
    </form>
  );
}
