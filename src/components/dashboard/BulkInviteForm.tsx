"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Field, FIELD_INPUT_CLASS } from "@/components/ui/Field";

/**
 * Bulk participant input — two input modalities feeding the SAME bulk-POST
 * endpoint and the SAME on-server dedup + validation pipeline:
 *
 *   (1) Free-form textarea ("Name, E-Mail" per line) — original entry point,
 *       parseBulkInput() handles the forgiving line format.
 *
 *   (2) CSV upload — feat/participant-csv. parseCsvInput() reads a proper
 *       CSV file (quoted fields, embedded commas, optional header,
 *       semicolon-tolerant for DE Excel exports) and produces the EXACT
 *       same ParsedLine[] shape that parseBulkInput emits. Both paths
 *       converge in submitInvites() before hitting the network.
 *
 * CSV path gets an extra "preview before send" step that the textarea
 * path doesn't need (the user can already see what they typed). Preview
 * shows: detected count, per-line issues, the parsed rows. Confirm goes
 * to submit; cancel discards and re-enables the file input.
 *
 * No new API, no new data path: both modalities POST the same
 *   { invites: [{ contactLabel, contactEmail }, ...] }
 * body that the participant-flow bulk POST already accepts. Server-side
 * dedup (against the existing plan + within the same request) is
 * unchanged and authoritative — the client preview is informational.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INVITES = 200;
/** Generous client-side guard against pathological CSV uploads. 200 invites
 *  at ~150 chars/line plus a header is well under 50 KB; 1 MB gives room for
 *  bulky labels / quoted notes without ever being a real limit in practice. */
const MAX_CSV_BYTES = 1_000_000;

interface ParsedLine {
  /** Original raw line as the user provided it — used for the issue list
   *  ("Zeile X: <message> — <raw>"). For CSV rows this is a reconstructed
   *  delimiter-joined view, which is fine for display. */
  raw: string;
  /** 1-based line number in the source (textarea row or CSV row including
   *  header). Stable across the file so issue messages map to what the
   *  user sees when they open the source. */
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

// ── Textarea parser (unchanged contract; the CSV parser below produces
//    the same shape so submitInvites() works for both) ─────────────────────

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

// ── CSV parser ────────────────────────────────────────────────────────────
// RFC-4180-flavored tokenizer with two pragmatic extensions:
//  (a) delimiter is auto-detected from the first non-empty line (',' vs ';'),
//      so DE Excel exports that default to ';' work without configuration.
//  (b) header detection looks at row 0 for the keywords name/email/etc.
//      and skips it; if no header is found, columns are taken positionally
//      (col 0 = name, col 1 = email).
//
// Output is parsed into the EXACT same ParsedLine shape as parseBulkInput
// so the downstream submitInvites() pipeline doesn't need to branch.

/** Tokenize a CSV string into rows of fields, handling quoted fields,
 *  escaped quotes ("" inside a quoted field), and CRLF/LF/CR line endings.
 *  No allocations per char beyond the field buffer; runs in O(input.length).
 */
function tokenizeCsv(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const c = input[i];

    if (inQuotes) {
      if (c === '"') {
        // Escaped quote ("") collapses to one literal quote.
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      current.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      // Eat the LF in a CRLF pair so we don't emit a phantom empty row.
      if (input[i + 1] === "\n") i += 2;
      else i++;
      continue;
    }
    if (c === "\n") {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      i++;
      continue;
    }

    field += c;
    i++;
  }

  // Flush the trailing field — handles files that don't end with a newline.
  if (field !== "" || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  return rows;
}

const HEADER_NAME_KEYS = new Set([
  "name",
  "fullname",
  "full name",
  "contact",
  "person",
  "teilnehmer",
  "teilnehmer/in",
  "nachname",
  "vorname",
]);
const HEADER_EMAIL_KEYS = new Set(["email", "e-mail", "mail", "e_mail"]);

export function parseCsvInput(input: string): ParseResult {
  // Strip UTF-8 BOM if present (common in Excel exports).
  const text = input.startsWith("﻿") ? input.slice(1) : input;

  // Auto-detect delimiter on the first non-empty line. We count both ','
  // and ';' OUTSIDE of quotes (a naive .match() would be fooled by commas
  // inside quoted names like '"Doe, Jane"'). Tracking quote state on the
  // first line is cheap.
  const firstLineEnd = (() => {
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === "\r" || c === "\n") return i;
    }
    return text.length;
  })();
  const firstLine = text.slice(0, firstLineEnd);
  let inQ = false;
  let cmtCount = 0;
  let semiCount = 0;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      if (inQ && firstLine[i + 1] === '"') {
        i++; // escaped
        continue;
      }
      inQ = !inQ;
      continue;
    }
    if (inQ) continue;
    if (ch === ",") cmtCount++;
    else if (ch === ";") semiCount++;
  }
  const delimiter = semiCount > cmtCount ? ";" : ",";

  const rows = tokenizeCsv(text, delimiter);

  // ── Header detection ─────────────────────────────────────────────────
  // Look at row 0. If any cell, normalized (lowercased + trimmed), matches
  // a known name- or email-header key, treat row 0 as a header and remember
  // the column indices. If no header detected, default to col 0 = name,
  // col 1 = email (matches the "name,email" format from the spec).
  let nameColIdx = 0;
  let emailColIdx = 1;
  let dataStart = 0;

  if (rows.length > 0) {
    const normalized = rows[0].map((c) => c.trim().toLowerCase());
    const hdrNameIdx = normalized.findIndex((c) => HEADER_NAME_KEYS.has(c));
    const hdrEmailIdx = normalized.findIndex((c) => HEADER_EMAIL_KEYS.has(c));

    if (hdrNameIdx !== -1 || hdrEmailIdx !== -1) {
      dataStart = 1;
      nameColIdx = hdrNameIdx !== -1 ? hdrNameIdx : -1;
      emailColIdx = hdrEmailIdx !== -1 ? hdrEmailIdx : -1;
      // If only the email header was found, the label fallback is "use
      // the email as the label" later in the row loop. Keep nameColIdx
      // at -1 so we don't accidentally pull a value from col 0 that
      // happens to be the email column.
    }
  }

  const parsed: ParsedLine[] = [];
  const issues: ParseIssue[] = [];

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    const lineNumber = r + 1;

    // Skip blank rows (every cell empty after trim) and comment rows
    // (first cell starts with '#'). Mirrors the textarea path.
    if (row.every((c) => c.trim() === "")) continue;
    if (row.length > 0 && row[0].trim().startsWith("#")) continue;

    // Reconstruct a display-only "raw" line for the issue list. We can't
    // recover the original delimiter spacing/quoting from tokens alone,
    // so we use the detected delimiter — good enough for the user to
    // spot which row they need to fix.
    const rawLine = row.map((c) => c.trim()).join(delimiter);

    const name =
      nameColIdx >= 0 && nameColIdx < row.length
        ? row[nameColIdx].trim()
        : "";
    const email =
      emailColIdx >= 0 && emailColIdx < row.length
        ? row[emailColIdx].trim()
        : "";

    let contactLabel = name;
    let contactEmail: string | null = email !== "" ? email : null;

    // No header path + single-column row: the lone cell is either an
    // email (use it as label too) or a name. Mirrors parseBulkInput's
    // single-segment branch so the two pipelines behave identically on
    // the degenerate input "just email" / "just name".
    if (contactLabel === "" && contactEmail === null && row.length === 1) {
      const only = row[0].trim();
      if (EMAIL_RE.test(only)) {
        contactLabel = only;
        contactEmail = only;
      } else {
        contactLabel = only;
      }
    }

    // Fallback when name column is missing/empty but email is valid:
    // use the email as the label (better than rejecting the row).
    if (contactLabel === "" && contactEmail && EMAIL_RE.test(contactEmail)) {
      contactLabel = contactEmail;
    }

    if (contactLabel === "") {
      issues.push({
        raw: rawLine,
        lineNumber,
        message: "Kein Name erkannt.",
      });
      continue;
    }
    if (contactLabel.length > 200) {
      issues.push({
        raw: rawLine,
        lineNumber,
        message: "Name zu lang (max 200 Zeichen).",
      });
      continue;
    }
    if (contactEmail && !EMAIL_RE.test(contactEmail)) {
      issues.push({
        raw: rawLine,
        lineNumber,
        message: "E-Mail hat kein gültiges Format.",
      });
      continue;
    }

    parsed.push({ raw: rawLine, lineNumber, contactLabel, contactEmail });
  }

  return { parsed, issues };
}

// ── Server response types ─────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────

interface CsvPreviewState {
  fileName: string;
  parsed: ParsedLine[];
  issues: ParseIssue[];
}

export function BulkInviteForm({ planId }: { planId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ServerResponse | null>(null);
  const [parseIssues, setParseIssues] = useState<ParseIssue[]>([]);
  const [csvPreview, setCsvPreview] = useState<CsvPreviewState | null>(null);
  // Ref so we can reset the <input type="file"> value after each load —
  // otherwise re-selecting the same filename doesn't fire onChange and the
  // user can't retry after a parse failure.
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function resetTransientUiState() {
    setError(null);
    setResponse(null);
    setParseIssues([]);
  }

  /**
   * Shared submit path — both the textarea form and the CSV-confirm step
   * funnel through here, so the request body is built in exactly one
   * place. Server-side dedup is authoritative; this client just shapes
   * the array.
   */
  async function submitInvites(rows: ParsedLine[]): Promise<boolean> {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/research/plans/${planId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invites: rows.map((p) => ({
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
      router.refresh();
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Bulk-Anlage fehlgeschlagen.",
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  // ── Textarea path ────────────────────────────────────────────────────
  async function handleTextareaSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetTransientUiState();

    const { parsed, issues } = parseBulkInput(text);
    if (issues.length > 0) setParseIssues(issues);
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

    const ok = await submitInvites(parsed);
    // Clear the textarea only if at least one row landed — otherwise
    // (everything was a duplicate) the user wants to see what they
    // pasted while looking at the result table.
    if (ok && (response?.summary?.created ?? 0) >= 0) {
      // We read summary from the latest response after submitInvites set
      // it. Doing the clear here keeps the post-success UX consistent
      // with the previous version: clear on any success, even if all
      // rows were duplicates (server returns success=true with
      // created=0). Behaviour preserved from feat/participant-flow.
      setText("");
    }
  }

  // ── CSV path ─────────────────────────────────────────────────────────
  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    resetTransientUiState();
    setCsvPreview(null);

    const file = event.target.files?.[0];
    // Reset the input regardless of outcome so re-uploading the same
    // filename works (browsers gate onChange on filename change).
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (file.size > MAX_CSV_BYTES) {
      setError(
        `CSV-Datei zu groß (${Math.round(file.size / 1024)} KB; max. ${Math.round(
          MAX_CSV_BYTES / 1024,
        )} KB). Bitte in kleinere Stapel teilen.`,
      );
      return;
    }

    let raw: string;
    try {
      raw = await file.text();
    } catch (err) {
      setError(
        err instanceof Error
          ? `CSV konnte nicht gelesen werden: ${err.message}`
          : "CSV konnte nicht gelesen werden.",
      );
      return;
    }

    const { parsed, issues } = parseCsvInput(raw);

    if (parsed.length === 0 && issues.length === 0) {
      setError(
        "Die CSV enthält keine erkennbaren Zeilen. Erwartet werden " +
          "Spalten: name,email (Header-Zeile optional).",
      );
      return;
    }
    if (parsed.length === 0) {
      setError(
        "Keine gültige Zeile in der CSV gefunden – siehe Hinweise unten.",
      );
      setParseIssues(issues);
      return;
    }
    if (parsed.length > MAX_INVITES) {
      setError(
        `Mehr als ${MAX_INVITES} gültige Zeilen in der CSV (${parsed.length} ` +
          "erkannt). Bitte in kleinere Stapel teilen.",
      );
      return;
    }

    // Happy path: stage the preview. User confirms before we POST. The
    // textarea path doesn't need this step because the user just typed
    // the content — the CSV path benefits from "what did the parser
    // actually see in the file I uploaded?".
    setCsvPreview({ fileName: file.name, parsed, issues });
  }

  function cancelCsvPreview() {
    setCsvPreview(null);
    setParseIssues([]);
  }

  async function confirmCsvPreview() {
    if (!csvPreview) return;
    const ok = await submitInvites(csvPreview.parsed);
    if (ok) setCsvPreview(null);
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-body-strong text-neutral-900">
          Mehrere Teilnehmer auf einmal
        </h4>
        <p className="mt-1 text-caption text-neutral-500">
          Per CSV-Datei hochladen (Spalten: <span className="font-mono">name,email</span> –
          Header-Zeile optional) oder weiter unten als freie Liste eintippen.
          Beide Wege landen in derselben Anlage-Logik (Duplikate werden
          automatisch übersprungen).
        </p>
      </div>

      {/* CSV upload — sits above the textarea since CSVs are the more
          structured input. The preview overlay below replaces this row
          while a file is staged for confirmation. */}
      {csvPreview === null ? (
        <Field
          label="CSV hochladen"
          hint="Akzeptiert Komma- und Semikolon-Separatoren (DE-Excel ok), Anführungszeichen für Namen mit Komma, BOM-Zeichen wird ignoriert."
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={handleFileChange}
            disabled={submitting}
            className="block w-full text-small text-neutral-700 file:mr-3 file:rounded-md file:border file:border-neutral-200 file:bg-white file:px-3 file:py-1.5 file:text-small file:font-medium file:text-neutral-900 hover:file:bg-neutral-50 disabled:opacity-60"
          />
        </Field>
      ) : (
        <CsvPreviewPanel
          preview={csvPreview}
          submitting={submitting}
          onConfirm={confirmCsvPreview}
          onCancel={cancelCsvPreview}
        />
      )}

      {/* Visual divider between the two input modalities. Disabled-looking
          when CSV preview is active to signal "deal with the CSV first". */}
      <div className="flex items-center gap-3 text-caption text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        <span className="uppercase tracking-wider">oder</span>
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <form onSubmit={handleTextareaSubmit} className="space-y-4">
        <Field
          label="Als Liste eintippen"
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
            disabled={submitting || csvPreview !== null}
            rows={8}
            className={`${FIELD_INPUT_CLASS} font-mono text-small leading-relaxed`}
          />
        </Field>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={submitting || csvPreview !== null}
          >
            {submitting ? "Lege an…" : "Liste anlegen"}
          </Button>
          <span className="text-small text-neutral-500">
            Max. {MAX_INVITES} pro Vorgang. Duplikate (gleiche E-Mail) werden
            übersprungen.
          </span>
        </div>
      </form>

      {/* Cross-cutting feedback — shown regardless of which path produced
          it. Error / parse-issues / server-response are all single-slot:
          the latest event wins. */}
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
    </div>
  );
}

/**
 * CSV preview overlay — shown after a file is parsed, before the request
 * goes out. Lists the detected rows + the per-row issues the parser
 * encountered, and exposes Confirm/Cancel. Server-side dedup will still
 * run on Confirm; this is purely a client-side "what did the file
 * actually contain?" sanity step.
 */
function CsvPreviewPanel({
  preview,
  submitting,
  onConfirm,
  onCancel,
}: {
  preview: CsvPreviewState;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const PREVIEW_LIMIT = 25;
  const shown = preview.parsed.slice(0, PREVIEW_LIMIT);
  const hidden = preview.parsed.length - shown.length;

  return (
    <div className="rounded-lg border border-primary-500/30 bg-primary-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-body-strong text-neutral-900">
            CSV-Vorschau:{" "}
            <span className="font-mono text-small">{preview.fileName}</span>
          </div>
          <div className="mt-1 text-small text-neutral-600">
            {preview.parsed.length}{" "}
            {preview.parsed.length === 1 ? "gültige Zeile" : "gültige Zeilen"}{" "}
            erkannt
            {preview.issues.length > 0 && (
              <>
                {" · "}
                <span className="text-warning-700">
                  {preview.issues.length}{" "}
                  {preview.issues.length === 1
                    ? "übersprungen"
                    : "übersprungen"}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={submitting}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={submitting || preview.parsed.length === 0}
          >
            {submitting
              ? "Lege an…"
              : `Bestätigen und ${preview.parsed.length} ${
                  preview.parsed.length === 1 ? "Teilnehmer" : "Teilnehmer"
                } anlegen`}
          </Button>
        </div>
      </div>

      {preview.issues.length > 0 && (
        <div className="mb-3 rounded-md border border-warning-500/20 bg-warning-50 px-3 py-2 text-small text-warning-700">
          <div className="font-medium">Übersprungene Zeilen:</div>
          <ul className="mt-1 space-y-0.5">
            {preview.issues.slice(0, 10).map((iss) => (
              <li key={`${iss.lineNumber}-${iss.message}`}>
                Zeile {iss.lineNumber}: {iss.message} —{" "}
                <span className="font-mono">
                  {iss.raw.length > 60 ? iss.raw.slice(0, 60) + "…" : iss.raw}
                </span>
              </li>
            ))}
            {preview.issues.length > 10 && (
              <li className="italic">
                …{preview.issues.length - 10} weitere
              </li>
            )}
          </ul>
        </div>
      )}

      <ul className="space-y-1 text-small text-neutral-700">
        {shown.map((r, i) => (
          <li key={`${r.lineNumber}-${i}`} className="font-mono">
            <span className="text-neutral-400">Zeile {r.lineNumber}:</span>{" "}
            <span className="text-neutral-900">{r.contactLabel}</span>
            {r.contactEmail ? (
              <> · {r.contactEmail}</>
            ) : (
              <span className="text-neutral-400"> · (keine E-Mail)</span>
            )}
          </li>
        ))}
        {hidden > 0 && (
          <li className="italic text-neutral-500">…{hidden} weitere</li>
        )}
      </ul>
    </div>
  );
}
