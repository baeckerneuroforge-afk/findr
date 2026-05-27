"use client";

import { useState } from "react";
import { Field, FIELD_INPUT_CLASS } from "@/components/ui/Field";
import type { DealStage } from "@/lib/deals/types";

const STAGES: Array<{ value: DealStage; label: string }> = [
  { value: "qualified", label: "Qualified" },
  { value: "demo", label: "Demo" },
  { value: "proposal_sent", label: "Proposal sent" },
  { value: "negotiation", label: "Negotiation" },
  { value: "verbal_commit", label: "Verbal commit" },
  { value: "closed_won", label: "Closed won" },
  { value: "closed_lost", label: "Closed lost" },
];

interface CreatedManualDeal {
  id: string;
  name: string;
  companyName?: string;
}

interface ManualDealFormProps {
  onCreated: (deal: CreatedManualDeal) => void;
}

interface FormState {
  name: string;
  companyName: string;
  amount: string;
  currency: "EUR" | "USD";
  stage: DealStage;
  ownerName: string;
  championName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  closeDate: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  companyName: "",
  amount: "",
  currency: "EUR",
  stage: "qualified",
  ownerName: "",
  championName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  closeDate: "",
};

export function ManualDealForm({ onCreated }: ManualDealFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Deal name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/deals/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: form.amount.trim() ? Number(form.amount) : 0,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.dealId) {
        throw new Error(data.error ?? "Could not create deal.");
      }

      onCreated({
        id: data.dealId,
        name: form.name.trim(),
        companyName: form.companyName.trim() || undefined,
      });
      setForm(INITIAL_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create deal.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Deal name" required>
          <input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Nordbank Enterprise Expansion"
            className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
            disabled={submitting}
          />
        </Field>

        <Field label="Company">
          <input
            value={form.companyName}
            onChange={(event) => update("companyName", event.target.value)}
            placeholder="Nordbank AG"
            className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
            disabled={submitting}
          />
        </Field>

        <Field label="Amount">
          <div className="grid grid-cols-[1fr_88px] gap-2">
            <input
              value={form.amount}
              onChange={(event) => update("amount", event.target.value)}
              inputMode="numeric"
              placeholder="85000"
              className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
              disabled={submitting}
            />
            <select
              value={form.currency}
              onChange={(event) =>
                update("currency", event.target.value as "EUR" | "USD")
              }
              className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-body text-neutral-900 outline-none focus:border-primary-500"
              disabled={submitting}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </Field>

        <Field label="Stage">
          <select
            value={form.stage}
            onChange={(event) => update("stage", event.target.value as DealStage)}
            className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none focus:border-primary-500"
            disabled={submitting}
          >
            {STAGES.map((stage) => (
              <option key={stage.value} value={stage.value}>
                {stage.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Owner">
          <input
            value={form.ownerName}
            onChange={(event) => update("ownerName", event.target.value)}
            placeholder="Sarah Müller"
            className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
            disabled={submitting}
          />
        </Field>

        <Field label="Champion">
          <input
            value={form.championName}
            onChange={(event) => update("championName", event.target.value)}
            placeholder="Thomas Becker"
            className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
            disabled={submitting}
          />
        </Field>

        <Field label="Contact name">
          <input
            value={form.contactName}
            onChange={(event) => update("contactName", event.target.value)}
            placeholder="Anna Berg"
            className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
            disabled={submitting}
          />
        </Field>

        <Field label="Contact email">
          <input
            type="email"
            value={form.contactEmail}
            onChange={(event) => update("contactEmail", event.target.value)}
            placeholder="anna.berg@example.com"
            className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
            disabled={submitting}
          />
        </Field>

        <Field label="Contact phone">
          <input
            value={form.contactPhone}
            onChange={(event) => update("contactPhone", event.target.value)}
            placeholder="+49 151 23456789"
            className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
            disabled={submitting}
          />
        </Field>

        <Field label="Expected close date">
          <input
            type="date"
            value={form.closeDate}
            onChange={(event) => update("closeDate", event.target.value)}
            className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
            disabled={submitting}
          />
        </Field>
      </div>

      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !form.name.trim()}
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary-600 px-4 text-body-strong font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Creating deal..." : "Create deal"}
      </button>
    </form>
  );
}

// Field + FIELD_INPUT_CLASS moved to src/components/ui/Field.tsx so the
// research-plan editor (and future forms) can share the exact same visual
// rhythm without inlining the markup. This file imports them from there.
