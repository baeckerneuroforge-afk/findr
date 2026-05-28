"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, FIELD_INPUT_CLASS } from "@/components/ui/Field";

/**
 * Bulk participant input — a textarea-based companion to InviteForm.
 * Accepts one participant per line in a forgiving "Name, E-Mail" format
 * (CSV-flavored but not strict CSV — no quoting, no escaping). Trailing
 * whitespace + blank lines + lines starting with # are skipped. The
 * comma is a soft separator; if it's missing we infer the shape:
 *
 *   "Jane Doe, jane@acme.example"   → label="Jane Doe",  email="jane@…"
 *   "jane@acme.example"             → label="jane@acme.example", email="jane@…"
 *   "Jane Doe"                       → label="Jane Doe",  email=null
 *   "Jane Doe, Acme, jane@acme.io"  → label="Jane Doe, Acme", email="jane@…"
 *     (last comma wins as the email-separator if the last segment looks
 *      like an email; otherwise the whole line is the label.)
 *
 * Email validity is a simple shape check — same regex as InviteForm. The
 * server re-validates with the canonical Zod schema, so this is just a
 * pre-flight to keep the table of results free of cosmetic noise.
 *
 * The server handles duplicate-skip across both (a) the existing plan and
 * (b) the same email appearing multiple times in this request. We just
 * post the parsed list and render the per-row outcomes.
 *
 * Hard cap of 200 mirrors the server's BulkBodySchema.max(200). If a
 * paste exceeds it we refuse client-side with a clear message rather
 * than letting the user wait for a 413.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INVITES = 200;

interface ParsedLine {
  raw: string;
  lineNumber: number;
  contactLabel: string;
  contactEmail: string | null;
}

interface ParseIssue {
  raw: string;
  lineNumber: number;
  message: string;
}

interface ParseResult {
  parsed: ParsedLine[];
  issues: ParseIssue[];
}

export function parseBulkInput(input: string): ParseResult {
  const parsed: ParsedLine[] = [];
  const issues: ParseIssue[] = [];

  const lines = input.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const lineNumber = idx + 1;
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) return;

    // Split on commas. If the last segment looks like an email, that's
    // the address and everything before is the label (joined back with
    // commas — so "Jane Doe, Acme, jane@acme.io" keeps "Jane Doe, Acme"
    // as the label). If no segment looks like an email, the whole line
    // is the label.
    const segments = line.split(",").map((s) => s.trim()).filter((s) => s !== "");

    let contactLabel = "";
    let contactEmail: string | null = null;

    if (segments.length === 0) {
      // Already filtered by the trim above, but defensive.
      return;
    } else if (segments.length === 1) {
      // Single segment — could be email-only or name-only.
      if (EMAIL_RE.test(segments[0])) {
        contactEmail = segments[0];
        contactLabel = segments[0];
      } else {
        contactLabel = segments[0];
      }
    } else {
      const last = segments[segments.length - 1];
      if (EMAIL_RE.test(last)) {
        contactEmail = last;
        contactLabel = segments.slice(0, -1).join(", ");
      } else {
        // No email present in any segment — keep the whole line as label.
        contactLabel = segments.join(", ");
      }
    }

    if (contactLabel === "") {
      issues.push({
        raw: rawLine,
        lineNumber,
        message: "Kein Name erkannt.",
      });
      return;
    }
    if (contactLabel.length > 200) {
      issues.push({
        raw: rawLine,
        lineNumber,
        message: "Name zu lang (max 200 Zeichen).",
      });
      return;
    }
    if (contactEmail && !EMAIL_RE.test(contactEmail)) {
      issues.push({
        raw: rawLine,
        lineNumber,
        message: "E-Mail hat kein gültiges Format.",
      });
      return;
    }

    parsed.push({
      raw: rawLine,
      lineNumber,
      contactLabel,
      contactEmail,
    });
  });

  return { parsed, issues };
}

type ServerResultItem = {
  contactLabel: string;
  contactEmail: string | null;
  status: "created" | "skipped_duplicate" | "invalid" | "error";
  message?: string;
};

interface ServerResponse {
  success?: boolean;
  results?: ServerResultItem[];
  summary?: { created: number; skipped: number; errors: number; total: number };
  error?: string;
}

const STATUS_LABEL: Record<ServerResultItem["status"], string> = {
  created: "Angelegt",
  skipped_duplicate: "Übersprungen (Duplikat)",
  invalid: "Ungültig",
  error: "Fehler",
};

const STATUS_TEXT_CLASS: Record<ServerResultItem["status"], string> = {
  created: "text-success-700",
  skipped_duplicate: "text-neutral-500",
  invalid: "text-danger-700",
  error: "text-danger-700",
};

export function BulkInviteForm({ planId }: { planId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ServerResponse | null>(null);
  const [parseIssues, setParseIssues] = useState<ParseIssue[]>([]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResponse(null);
    setParseIssues([]);

    const { parsed, issues } = parseBulkInput(text);
    if (issues.length > 0) {
      setParseIssues(issues);
    }
    if (parsed.length === 0) {
      setError(
        issues.length > 0
          ? "Keine gültige Zeile gefunden – siehe Hinweise unten."
          : "Bitte mindestens einen Teilnehmer pro Zeile eingeben.",
      );
      return;
    }
    if (parsed.length > MAX_INVITES) {
      setError(
        `Maximal ${MAX_INVITES} Teilnehmer pro Vorgang. Bitte in kleinere ` +
          "Stapel aufteilen.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/research/plans/${planId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invites: parsed.map((p) => ({
            contactLabel: p.contactLabel,
            contactEmail: p.contactEmail,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ServerResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Bulk-Anlage fehlgeschlagen.");
      }
      setResponse(data);
      // Clear the textarea only if at least one row landed — otherwise
      // (everything was a duplicate) the user wants to see what they
      // pasted while looking at the result table.
      if ((data.summary?.created ?? 0) > 0) {
        setText("");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk-Anlage fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label="Mehrere Teilnehmer auf einmal"
        hint='Eine Zeile pro Person, Format: "Name, E-Mail". E-Mail ist optional. Leere Zeilen und Zeilen, die mit # beginnen, werden übersprungen.'
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            "Jane Doe, jane@acme.example\n" +
            "Max Mustermann, max@example.com\n" +
            "# Kommentar-Zeile wird übersprungen\n" +
            "Anonymer Teilnehmer"
          }
          disabled={submitting}
          rows={8}
          className={`${FIELD_INPUT_CLASS} font-mono text-small leading-relaxed`}
        />
      </Field>

      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}

      {parseIssues.length > 0 && (
        <div className="rounded-md border border-warning-500/20 bg-warning-50 px-3 py-2 text-small text-warning-700">
          <div className="font-medium">
            {parseIssues.length}{" "}
            {parseIssues.length === 1
              ? "Zeile übersprungen"
              : "Zeilen übersprungen"}
            :
          </div>
          <ul className="mt-1 space-y-0.5">
            {parseIssues.slice(0, 10).map((iss) => (
              <li key={iss.lineNumber}>
                Zeile {iss.lineNumber}: {iss.message} —{" "}
                <span className="font-mono">
                  {iss.raw.length > 60 ? iss.raw.slice(0, 60) + "…" : iss.raw}
                </span>
              </li>
            ))}
            {parseIssues.length > 10 && (
              <li className="italic">
                …{parseIssues.length - 10} weitere
              </li>
            )}
          </ul>
        </div>
      )}

      {response?.results && response.summary && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-small">
          <div className="mb-2 font-medium text-neutral-900">
            {response.summary.created} angelegt ·{" "}
            {response.summary.skipped} übersprungen ·{" "}
            {response.summary.errors} Fehler
          </div>
          <ul className="space-y-0.5">
            {response.results.map((r, i) => (
              <li key={i} className={STATUS_TEXT_CLASS[r.status]}>
                <span className="font-medium">{STATUS_LABEL[r.status]}</span>
                {" — "}
                {r.contactLabel}
                {r.contactEmail ? ` · ${r.contactEmail}` : ""}
                {r.message ? ` (${r.message})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Lege an…" : "Mehrere anlegen"}
        </Button>
        <span className="text-small text-neutral-500">
          Max. {MAX_INVITES} pro Vorgang. Duplikate (gleiche E-Mail) werden
          übersprungen.
        </span>
      </div>
    </form>
  );
}
