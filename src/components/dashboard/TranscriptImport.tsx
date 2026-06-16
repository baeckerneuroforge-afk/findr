"use client";

import { useRef, useState } from "react";

interface TranscriptImportProps {
  dealId: string;
  onAdded: (call: { id: string }) => void;
}

export function TranscriptImport({ dealId, onAdded }: TranscriptImportProps) {
  const [transcript, setTranscript] = useState("");
  const [callType, setCallType] = useState("Discovery call");
  const [recordedAt, setRecordedAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".txt") && file.type !== "text/plain") {
      setMessage("Please choose a .txt transcript file.");
      event.target.value = "";
      return;
    }

    const text = await file.text();
    setTranscript(text);
    setMessage(`Loaded ${file.name}.`);
    event.target.value = "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transcript.trim()) {
      setMessage("Paste a transcript before adding the call.");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/calls/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId,
          transcript,
          callType,
          recordedAt,
          durationSeconds: durationMinutes.trim()
            ? Math.round(Number(durationMinutes) * 60)
            : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.callId) {
        throw new Error(data.error ?? "Could not add transcript.");
      }

      onAdded({ id: data.callId });
      setTranscript("");
      setMessage("Transcript added. You can add another call or continue.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not add transcript.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-body-strong text-neutral-900">
            Call type
          </span>
          <input
            value={callType}
            onChange={(event) => setCallType(event.target.value)}
            className="h-9 w-full rounded-md border border-neutral-200 bg-card px-3 text-body text-neutral-900 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
            disabled={submitting}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-body-strong text-neutral-900">
            Recorded at
          </span>
          <input
            type="date"
            value={recordedAt}
            onChange={(event) => setRecordedAt(event.target.value)}
            className="h-9 w-full rounded-md border border-neutral-200 bg-card px-3 text-body text-neutral-900 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
            disabled={submitting}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-body-strong text-neutral-900">
            Duration
          </span>
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <input
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              inputMode="numeric"
              placeholder="45"
              className="h-9 w-full rounded-md border border-neutral-200 bg-card px-3 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
              disabled={submitting}
            />
            <span className="text-small text-neutral-500">min</span>
          </div>
        </label>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <label
              htmlFor="manual-transcript"
              className="text-body-strong text-neutral-900"
            >
              Transcript
            </label>
            <p className="mt-1 max-w-2xl text-small leading-relaxed text-neutral-500">
              Paste raw text. Speaker prefixes like &ldquo;Sarah: ...&rdquo;
              help, but are optional; Klymeo can analyze raw transcript text.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-8 items-center justify-center rounded-md border border-neutral-200 bg-card px-3 text-body-strong text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Import .txt
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <textarea
          id="manual-transcript"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder="Paste your call transcript here..."
          rows={14}
          className="w-full rounded-lg border border-neutral-200 bg-card px-3 py-3 text-body leading-relaxed text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
          disabled={submitting}
        />
      </div>

      {message && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-small text-neutral-600">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !transcript.trim()}
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary-600 px-4 text-body-strong font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Adding transcript..." : "Add transcript"}
      </button>
    </form>
  );
}
