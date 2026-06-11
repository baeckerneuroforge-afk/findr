/**
 * Pure CSV-/Listen-Parser für Teilnehmer-Eingaben — bewusst ohne "use client",
 * ohne i18n und ohne Netzwerk, damit beide Aufrufer (BulkInviteForm für
 * Plan-Invites, PoolCsvImport für den Teilnehmer-Pool) und die Tests dieselbe
 * Implementierung teilen.
 *
 * Provenienz: parseBulkInput / tokenizeCsv / parseCsvInput sind VERBATIM aus
 * src/components/dashboard/BulkInviteForm.tsx hierher gezogen (feat/
 * participant-csv) — Verhalten ist durch parse.test.ts gepinnt. Neu dazu kommt
 * parsePoolCsv: dieselbe Tokenizer-/Delimiter-/Header-Mechanik, aber mit den
 * Pool-Spalten (Rolle, Segment, Tags, Notizen) über Header-Mapping.
 *
 * Issue-Meldungen bleiben i18n-frei: Parser geben messageKeys zurück, die die
 * UI zur Renderzeit unter ihrem Namespace auflöst.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Generous client-side guard against pathological CSV uploads. 200 invites
 *  at ~150 chars/line plus a header is well under 50 KB; 1 MB gives room for
 *  bulky labels / quoted notes without ever being a real limit in practice. */
export const MAX_CSV_BYTES = 1_000_000;

export interface ParsedLine {
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

export type InviteIssueKey = "issueNoName" | "issueNameTooLong" | "issueInvalidEmail";

export interface ParseIssue {
  raw: string;
  lineNumber: number;
  /** Translation key under research.plans for the issue reason — resolved at
   *  render time so the pure parsers stay i18n-free and testable. */
  messageKey: InviteIssueKey;
}

export interface ParseResult {
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
        messageKey: "issueNoName",
      });
      return;
    }
    if (contactLabel.length > 200) {
      issues.push({
        raw: rawLine,
        lineNumber,
        messageKey: "issueNameTooLong",
      });
      return;
    }
    if (contactEmail && !EMAIL_RE.test(contactEmail)) {
      issues.push({
        raw: rawLine,
        lineNumber,
        messageKey: "issueInvalidEmail",
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

/** Strip UTF-8 BOM if present (common in Excel exports) and auto-detect the
 *  delimiter on the first non-empty line. We count both ',' and ';' OUTSIDE
 *  of quotes (a naive .match() would be fooled by commas inside quoted names
 *  like '"Doe, Jane"'). Tracking quote state on the first line is cheap. */
function stripBomAndDetectDelimiter(input: string): { text: string; delimiter: string } {
  const text = input.startsWith("﻿") ? input.slice(1) : input;

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
  return { text, delimiter };
}

export function parseCsvInput(input: string): ParseResult {
  const { text, delimiter } = stripBomAndDetectDelimiter(input);

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
        messageKey: "issueNoName",
      });
      continue;
    }
    if (contactLabel.length > 200) {
      issues.push({
        raw: rawLine,
        lineNumber,
        messageKey: "issueNameTooLong",
      });
      continue;
    }
    if (contactEmail && !EMAIL_RE.test(contactEmail)) {
      issues.push({
        raw: rawLine,
        lineNumber,
        messageKey: "issueInvalidEmail",
      });
      continue;
    }

    parsed.push({ raw: rawLine, lineNumber, contactLabel, contactEmail });
  }

  return { parsed, issues };
}

// ── Pool-CSV parser ───────────────────────────────────────────────────────
// Gleiche Mechanik wie parseCsvInput (Tokenizer, Delimiter-Autodetect, BOM,
// Header-Erkennung, Kommentar-/Leerzeilen), aber mit den Pool-Spalten. Die
// erweiterten Spalten (Rolle/Segment/Tags/Notizen) werden AUSSCHLIESSLICH per
// Header-Keyword gemappt — Positions-Raten über sechs Spalten wäre fragil.
// Ohne Header bleibt das positionsbasierte Name(0)/E-Mail(1)-Verhalten des
// Invite-Parsers erhalten und die erweiterten Felder bleiben leer.
//
// Feld-Limits spiegeln das PoolMemberSchema der API (Label 200, Rolle/Segment
// 80, ≤30 Tags à ≤40, Notizen 2000): Zeilen mit Verstößen werden geskippt und
// als Issue gemeldet, statt server-seitig den ganzen Batch zu reißen.

const HEADER_ROLE_KEYS = new Set([
  "role",
  "rolle",
  "position",
  "funktion",
  "jobtitel",
  "job title",
  "titel",
]);
const HEADER_SEGMENT_KEYS = new Set([
  "segment",
  "zielgruppe",
  "kundensegment",
]);
const HEADER_TAGS_KEYS = new Set([
  "tags",
  "tag",
  "labels",
  "schlagworte",
  "schlagwörter",
  "stichworte",
]);
const HEADER_NOTES_KEYS = new Set([
  "notes",
  "note",
  "notizen",
  "notiz",
  "anmerkung",
  "anmerkungen",
  "kommentar",
  "kommentare",
  "bemerkung",
]);

export const MAX_POOL_TAGS = 30;
export const MAX_POOL_TAG_LENGTH = 40;
export const MAX_POOL_ROLE_LENGTH = 80;
export const MAX_POOL_SEGMENT_LENGTH = 80;
export const MAX_POOL_NOTES_LENGTH = 2000;

export type PoolIssueKey =
  | InviteIssueKey
  | "issueRoleTooLong"
  | "issueSegmentTooLong"
  | "issueTagsInvalid"
  | "issueNotesTooLong";

export interface PoolParsedRow {
  raw: string;
  lineNumber: number;
  contactLabel: string;
  contactEmail: string | null;
  role: string | null;
  segment: string | null;
  tags: string[];
  notes: string | null;
}

export interface PoolParseIssue {
  raw: string;
  lineNumber: number;
  messageKey: PoolIssueKey;
}

export interface PoolParseResult {
  parsed: PoolParsedRow[];
  issues: PoolParseIssue[];
}

/** Tag-Zelle ("B2B, Founder; Enterprise") → normalisiertes, dedupliziertes
 *  Array. EXAKT dieselbe Regel wie parseTags in ParticipantPoolManager, damit
 *  CSV-Import und manuelle Eingabe identische Tag-Arrays erzeugen. */
function parsePoolTagsCell(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[,;\n]/)
        .map((t) => t.trim())
        .filter((t) => t !== ""),
    ),
  ];
}

export function parsePoolCsv(input: string): PoolParseResult {
  const { text, delimiter } = stripBomAndDetectDelimiter(input);

  const rows = tokenizeCsv(text, delimiter);

  // Header-Erkennung wie parseCsvInput, erweitert um die Pool-Spalten: Header
  // gilt als erkannt, sobald IRGENDEIN bekanntes Keyword in Zeile 0 auftaucht.
  let nameColIdx = 0;
  let emailColIdx = 1;
  let roleColIdx = -1;
  let segmentColIdx = -1;
  let tagsColIdx = -1;
  let notesColIdx = -1;
  let dataStart = 0;

  if (rows.length > 0) {
    const normalized = rows[0].map((c) => c.trim().toLowerCase());
    const hdrNameIdx = normalized.findIndex((c) => HEADER_NAME_KEYS.has(c));
    const hdrEmailIdx = normalized.findIndex((c) => HEADER_EMAIL_KEYS.has(c));
    const hdrRoleIdx = normalized.findIndex((c) => HEADER_ROLE_KEYS.has(c));
    const hdrSegmentIdx = normalized.findIndex((c) => HEADER_SEGMENT_KEYS.has(c));
    const hdrTagsIdx = normalized.findIndex((c) => HEADER_TAGS_KEYS.has(c));
    const hdrNotesIdx = normalized.findIndex((c) => HEADER_NOTES_KEYS.has(c));

    if (
      hdrNameIdx !== -1 ||
      hdrEmailIdx !== -1 ||
      hdrRoleIdx !== -1 ||
      hdrSegmentIdx !== -1 ||
      hdrTagsIdx !== -1 ||
      hdrNotesIdx !== -1
    ) {
      dataStart = 1;
      nameColIdx = hdrNameIdx;
      emailColIdx = hdrEmailIdx;
      roleColIdx = hdrRoleIdx;
      segmentColIdx = hdrSegmentIdx;
      tagsColIdx = hdrTagsIdx;
      notesColIdx = hdrNotesIdx;
    }
  }

  const cell = (row: string[], idx: number): string =>
    idx >= 0 && idx < row.length ? row[idx].trim() : "";

  const parsed: PoolParsedRow[] = [];
  const issues: PoolParseIssue[] = [];

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    const lineNumber = r + 1;

    if (row.every((c) => c.trim() === "")) continue;
    if (row.length > 0 && row[0].trim().startsWith("#")) continue;

    const rawLine = row.map((c) => c.trim()).join(delimiter);

    const name = cell(row, nameColIdx);
    const email = cell(row, emailColIdx);
    const role = cell(row, roleColIdx);
    const segment = cell(row, segmentColIdx);
    const tagsCell = cell(row, tagsColIdx);
    const notes = cell(row, notesColIdx);

    let contactLabel = name;
    let contactEmail: string | null = email !== "" ? email : null;

    // Degenerate-Verhalten 1:1 vom Invite-Parser übernommen.
    if (contactLabel === "" && contactEmail === null && row.length === 1) {
      const only = row[0].trim();
      if (EMAIL_RE.test(only)) {
        contactLabel = only;
        contactEmail = only;
      } else {
        contactLabel = only;
      }
    }
    if (contactLabel === "" && contactEmail && EMAIL_RE.test(contactEmail)) {
      contactLabel = contactEmail;
    }

    const pushIssue = (messageKey: PoolIssueKey) =>
      issues.push({ raw: rawLine, lineNumber, messageKey });

    if (contactLabel === "") {
      pushIssue("issueNoName");
      continue;
    }
    if (contactLabel.length > 200) {
      pushIssue("issueNameTooLong");
      continue;
    }
    if (contactEmail && !EMAIL_RE.test(contactEmail)) {
      pushIssue("issueInvalidEmail");
      continue;
    }
    if (role.length > MAX_POOL_ROLE_LENGTH) {
      pushIssue("issueRoleTooLong");
      continue;
    }
    if (segment.length > MAX_POOL_SEGMENT_LENGTH) {
      pushIssue("issueSegmentTooLong");
      continue;
    }
    const tags = parsePoolTagsCell(tagsCell);
    if (tags.length > MAX_POOL_TAGS || tags.some((t) => t.length > MAX_POOL_TAG_LENGTH)) {
      pushIssue("issueTagsInvalid");
      continue;
    }
    if (notes.length > MAX_POOL_NOTES_LENGTH) {
      pushIssue("issueNotesTooLong");
      continue;
    }

    parsed.push({
      raw: rawLine,
      lineNumber,
      contactLabel,
      contactEmail,
      role: role === "" ? null : role,
      segment: segment === "" ? null : segment,
      tags,
      notes: notes === "" ? null : notes,
    });
  }

  return { parsed, issues };
}
