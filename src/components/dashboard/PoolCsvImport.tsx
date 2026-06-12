"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import {
  decodeCsvBuffer,
  MAX_CSV_BYTES,
  MAX_POOL_IMPORT_ROWS,
  parsePoolCsv,
  POOL_CSV_TEMPLATES,
  type PoolParsedRow,
  type PoolParseIssue,
} from "@/lib/csv/parse";
import type { PoolMember } from "@/components/dashboard/ParticipantPoolManager";

/**
 * CSV-Import in den Teilnehmer-Pool — Klon des CSV-Pfads aus BulkInviteForm,
 * aber gegen POST /api/research/pool/import und mit den Pool-Spalten
 * (Rolle/Segment/Tags/Notizen via Header-Mapping, siehe lib/csv/parse.ts).
 *
 * Ablauf: Datei wählen → client-seitig parsen → Vorschau mit Issues →
 * bestätigen → POST → Ergebnisliste. Server-Dedup (Email unique pro Org) ist
 * autoritativ; die Vorschau ist rein informativ.
 *
 * Erfolgreich angelegte Personen kommen als volle PoolMember-Records zurück
 * und werden via `onImported` an den Manager gereicht — der hält seine Liste
 * nach Mount autoritativ im State, daher KEIN router.refresh hier.
 */

interface CsvPreviewState {
  fileName: string;
  parsed: PoolParsedRow[];
  issues: PoolParseIssue[];
}

type ServerResultItem = {
  contactLabel: string;
  contactEmail: string | null;
  status: "created" | "skipped_duplicate" | "invalid" | "error";
  member?: PoolMember;
  message?: string;
};

interface ServerResponse {
  success?: boolean;
  results?: ServerResultItem[];
  summary?: { created: number; skipped: number; errors: number; total: number };
  error?: string;
}

const STATUS_LABEL_KEY: Record<ServerResultItem["status"], string> = {
  created: "importStatusCreated",
  skipped_duplicate: "importStatusSkippedDup",
  invalid: "importStatusInvalid",
  error: "importStatusError",
};

const STATUS_TEXT_CLASS: Record<ServerResultItem["status"], string> = {
  created: "text-success-700",
  skipped_duplicate: "text-neutral-500",
  invalid: "text-danger-700",
  error: "text-danger-700",
};

export function PoolCsvImport({
  onImported,
}: {
  onImported: (members: PoolMember[]) => void;
}) {
  const t = useTranslations("research.pool");
  const locale = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseIssues, setParseIssues] = useState<PoolParseIssue[]>([]);
  const [preview, setPreview] = useState<CsvPreviewState | null>(null);
  const [response, setResponse] = useState<ServerResponse | null>(null);
  // Ref, um den <input type="file"> nach jedem Load zurückzusetzen — sonst
  // feuert die erneute Auswahl derselben Datei kein onChange.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Monotone Lese-Sequenz: wählt der Nutzer eine zweite Datei, während die
  // erste noch gelesen wird (Drag-and-drop aufs Input, langsame Cloud-/
  // Netzlaufwerke), darf das ÄLTERE Ergebnis den State der neueren Auswahl
  // nicht überschreiben — sonst bestätigt man Datei A im Glauben, B zu sehen.
  const readSeqRef = useRef(0);

  function resetTransientUiState() {
    setError(null);
    setResponse(null);
    setParseIssues([]);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    resetTransientUiState();
    setPreview(null);

    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (file.size > MAX_CSV_BYTES) {
      setError(
        t("errCsvTooBig", {
          size: Math.round(file.size / 1024),
          max: Math.round(MAX_CSV_BYTES / 1024),
        }),
      );
      return;
    }

    const readSeq = ++readSeqRef.current;

    let raw: string;
    try {
      // arrayBuffer + decodeCsvBuffer statt file.text(): deutsche Excel-
      // Exporte („CSV (Trennzeichen-getrennt)") sind Windows-1252 — file.text()
      // dekodiert immer UTF-8 und machte aus Umlauten stille U+FFFD-Mojibake,
      // die validiert und dauerhaft in den Pool importiert würde.
      raw = decodeCsvBuffer(await file.arrayBuffer());
    } catch (err) {
      if (readSeq !== readSeqRef.current) return;
      setError(
        err instanceof Error
          ? t("errCsvReadMsg", { msg: err.message })
          : t("errCsvRead"),
      );
      return;
    }
    if (readSeq !== readSeqRef.current) return;

    const { parsed, issues } = parsePoolCsv(raw);

    if (parsed.length === 0 && issues.length === 0) {
      setError(t("errCsvNoRows"));
      return;
    }
    if (parsed.length === 0) {
      setError(t("errCsvNoValid"));
      setParseIssues(issues);
      return;
    }
    if (parsed.length > MAX_POOL_IMPORT_ROWS) {
      setError(t("errCsvTooMany", { max: MAX_POOL_IMPORT_ROWS, count: parsed.length }));
      return;
    }

    setPreview({ fileName: file.name, parsed, issues });
  }

  function cancelPreview() {
    setPreview(null);
    setParseIssues([]);
  }

  async function confirmImport() {
    if (!preview) return;
    setSubmitting(true);
    // Fehler eines früheren Versuchs räumen — sonst stünde nach einem
    // geglückten Retry das alte rote Banner neben der Erfolgs-Zusammenfassung.
    setError(null);
    try {
      const res = await fetch("/api/research/pool/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          members: preview.parsed.map((row) => ({
            contactLabel: row.contactLabel,
            contactEmail: row.contactEmail,
            role: row.role,
            segment: row.segment,
            tags: row.tags,
            notes: row.notes,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ServerResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? t("errImport"));
      }
      setResponse(data);
      // Client-seitig übersprungene Zeilen über den Erfolg hinaus sichtbar
      // halten: die Vorschau (und damit ihre Issue-Liste) verschwindet gleich —
      // ohne diese Übernahme behauptete „40 angelegt · 0 übersprungen" einen
      // vollständigen Import, obwohl der Parser z. B. 10 Zeilen vorab
      // gefiltert hat. Der Nutzer braucht Zeilennummern + Gründe zum
      // Nachpflegen.
      setParseIssues(preview.issues);
      setPreview(null);
      const createdMembers = (data.results ?? [])
        .filter(
          (r): r is ServerResultItem & { member: PoolMember } =>
            r.status === "created" && !!r.member,
        )
        .map((r) => r.member);
      if (createdMembers.length > 0) onImported(createdMembers);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errImport"));
    } finally {
      setSubmitting(false);
    }
  }

  function downloadTemplate() {
    const template = POOL_CSV_TEMPLATES[locale] ?? POOL_CSV_TEMPLATES.de;
    const blob = new Blob([template.content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = template.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Revoke einen Tick später — Safari startet den Download asynchron und
    // verliert ihn bei sofortigem Revoke (Muster aus ExportSynthesisPdfButton).
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-h3 text-neutral-900">{t("csvTitle")}</h3>
        <p className="mt-1 text-caption text-neutral-500">{t("csvDesc")}</p>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          {preview === null ? (
            <Field label={t("csvUpload")} hint={t("csvUploadHint")}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleFileChange}
                disabled={submitting}
                className="block w-full text-small text-neutral-700 file:mr-3 file:rounded-md file:border file:border-neutral-200 file:bg-card file:px-3 file:py-1.5 file:text-small file:font-medium file:text-neutral-900 hover:file:bg-neutral-50 disabled:opacity-60"
              />
            </Field>
          ) : (
            <PoolCsvPreviewPanel
              preview={preview}
              submitting={submitting}
              onConfirm={confirmImport}
              onCancel={cancelPreview}
            />
          )}

          <button
            type="button"
            onClick={downloadTemplate}
            className="text-small text-neutral-500 underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-neutral-900"
          >
            {t("csvTemplate")}
          </button>

          {error && (
            <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
              {error}
            </div>
          )}

          {parseIssues.length > 0 && <PoolIssueList issues={parseIssues} />}

          {response?.results && response.summary && (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-small">
              <div className="mb-2 font-medium text-neutral-900">
                {t("importSummary", {
                  created: response.summary.created,
                  skipped: response.summary.skipped,
                  errors: response.summary.errors,
                })}
              </div>
              <ul className="space-y-0.5">
                {response.results.map((r, i) => {
                  // Deploy-Skew-Schutz: ein unbekannter Status aus einer
                  // neueren Server-Version fällt auf die Fehler-Optik zurück,
                  // statt dass t(undefined) den rohen Namespace rendert.
                  const status: ServerResultItem["status"] =
                    r.status in STATUS_LABEL_KEY ? r.status : "error";
                  return (
                    <li key={i} className={STATUS_TEXT_CLASS[status]}>
                      <span className="font-medium">{t(STATUS_LABEL_KEY[status])}</span>
                      {" — "}
                      {r.contactLabel}
                      {r.contactEmail ? ` · ${r.contactEmail}` : ""}
                      {r.message ? ` (${r.message})` : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function PoolIssueList({ issues }: { issues: PoolParseIssue[] }) {
  const t = useTranslations("research.pool");
  return (
    <div className="rounded-md border border-warning-500/20 bg-warning-50 px-3 py-2 text-small text-warning-700">
      <div className="font-medium">
        {t("issuesSkipped", { count: issues.length })}:
      </div>
      <ul className="mt-1 space-y-0.5">
        {issues.slice(0, 10).map((iss) => (
          <li key={`${iss.lineNumber}-${iss.messageKey}`}>
            {t("issueLine", {
              line: iss.lineNumber,
              message: t(iss.messageKey),
            })}
            <span className="font-mono">
              {iss.raw.length > 60 ? iss.raw.slice(0, 60) + "…" : iss.raw}
            </span>
          </li>
        ))}
        {issues.length > 10 && (
          <li className="italic">{t("moreN", { count: issues.length - 10 })}</li>
        )}
      </ul>
    </div>
  );
}

/**
 * Vorschau vor dem Import — zeigt, was der Parser in der Datei gesehen hat,
 * inkl. der Pool-Attribute pro Zeile. Confirm POSTet; Server-Dedup läuft
 * danach trotzdem autoritativ.
 */
function PoolCsvPreviewPanel({
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
  const t = useTranslations("research.pool");
  const tc = useTranslations("research.common");
  const PREVIEW_LIMIT = 25;
  const shown = preview.parsed.slice(0, PREVIEW_LIMIT);
  const hidden = preview.parsed.length - shown.length;

  return (
    <div className="rounded-lg border border-primary-500/30 bg-primary-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-body-strong text-neutral-900">
            {t("csvPreviewTitle")}{" "}
            <span className="font-mono text-small">{preview.fileName}</span>
          </div>
          <div className="mt-1 text-small text-neutral-600">
            {t("csvValidRows", { count: preview.parsed.length })}
            {preview.issues.length > 0 && (
              <span className="text-warning-700">
                {t("csvSkippedSuffix", { count: preview.issues.length })}
              </span>
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
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={submitting || preview.parsed.length === 0}
          >
            {submitting
              ? t("csvImporting")
              : t("csvConfirmImport", { count: preview.parsed.length })}
          </Button>
        </div>
      </div>

      {preview.issues.length > 0 && <PoolIssueList issues={preview.issues} />}

      <ul className="mt-3 space-y-1.5 text-small text-neutral-700">
        {shown.map((r, i) => {
          const attributes = [
            r.role,
            r.segment,
            r.tags.length > 0 ? r.tags.join(", ") : null,
            r.notes,
          ].filter((v): v is string => !!v);
          return (
            <li key={`${r.lineNumber}-${i}`}>
              <div className="font-mono">
                <span className="text-neutral-400">
                  {t("csvRowLine", { line: r.lineNumber })}
                </span>{" "}
                <span className="text-neutral-900">{r.contactLabel}</span>
                {r.contactEmail ? (
                  <> · {r.contactEmail}</>
                ) : (
                  <span className="text-neutral-400">{t("csvNoEmail")}</span>
                )}
              </div>
              {attributes.length > 0 && (
                <div className="ml-4 text-caption text-neutral-500">
                  {attributes.join(" · ")}
                </div>
              )}
            </li>
          );
        })}
        {hidden > 0 && (
          <li className="italic text-neutral-500">
            {t("moreN", { count: hidden })}
          </li>
        )}
      </ul>
    </div>
  );
}
