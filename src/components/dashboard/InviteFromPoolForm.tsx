"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FIELD_INPUT_CLASS } from "@/components/ui/Field";
import type { PoolMember } from "@/components/dashboard/ParticipantPoolManager";

/**
 * „Aus Pool einladen“ auf der Plan-Detail-Seite — dritte Eingabe-Modalität
 * neben Einzel-Form und CSV/Textarea-Bulk. Wählt Personen aus dem org-weiten
 * Pool und ruft POST /invite-from-pool, das jede Einladung über den
 * BESTEHENDEN createResearchInvite-Pfad erzeugt (kein paralleler Datenpfad)
 * und via participant_pool_invites verknüpft.
 *
 * Bereits aus dem Pool in diese Studie eingeladene Personen sind deaktiviert
 * markiert. Nach erfolgreichem Einladen: router.refresh, damit die Teilnehmer-
 * Tabelle + die Quoten-Anzeige oben den neuen Stand zeigen.
 */

const ALL = "__all__";

type ItemStatus =
  | "invited"
  | "already_invited"
  | "skipped_duplicate"
  | "not_found"
  | "error";

interface ResultItem {
  poolMemberId: string;
  contactLabel: string;
  status: ItemStatus;
  message?: string;
}

interface ServerResponse {
  success?: boolean;
  results?: ResultItem[];
  summary?: { invited: number; skipped: number; errors: number; total: number };
  error?: string;
}

const STATUS_LABEL_KEY: Record<ItemStatus, string> = {
  invited: "poolStatusInvited",
  already_invited: "poolStatusAlreadyInvited",
  skipped_duplicate: "poolStatusSkippedDup",
  not_found: "poolStatusNotFound",
  error: "poolStatusError",
};

const STATUS_TEXT_CLASS: Record<ItemStatus, string> = {
  invited: "text-success-700",
  already_invited: "text-neutral-500",
  skipped_duplicate: "text-neutral-500",
  not_found: "text-danger-700",
  error: "text-danger-700",
};

export function InviteFromPoolForm({
  planId,
  poolMembers,
  invitedMemberIds,
}: {
  planId: string;
  poolMembers: PoolMember[];
  invitedMemberIds: string[];
}) {
  const router = useRouter();
  const t = useTranslations("research.plans");
  const tc = useTranslations("research.common");
  const [invited, setInvited] = useState<Set<string>>(new Set(invitedMemberIds));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterRole, setFilterRole] = useState<string>(ALL);
  const [filterSegment, setFilterSegment] = useState<string>(ALL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ServerResponse | null>(null);

  const roles = useMemo(
    () => [...new Set(poolMembers.map((m) => m.role).filter((r): r is string => !!r))].sort(),
    [poolMembers],
  );
  const segments = useMemo(
    () => [...new Set(poolMembers.map((m) => m.segment).filter((s): s is string => !!s))].sort(),
    [poolMembers],
  );

  const filtered = useMemo(
    () =>
      poolMembers.filter((m) => {
        if (filterRole !== ALL && m.role !== filterRole) return false;
        if (filterSegment !== ALL && m.segment !== filterSegment) return false;
        return true;
      }),
    [poolMembers, filterRole, filterSegment],
  );

  // Auswählbar = gefiltert UND noch nicht eingeladen.
  const selectableIds = useMemo(
    () => filtered.filter((m) => !invited.has(m.id)).map((m) => m.id),
    [filtered, invited],
  );
  const allSelectableChecked =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((cur) => {
      if (allSelectableChecked) {
        const next = new Set(cur);
        for (const id of selectableIds) next.delete(id);
        return next;
      }
      return new Set([...cur, ...selectableIds]);
    });
  }

  async function handleInvite() {
    const ids = [...selected].filter((id) => !invited.has(id));
    if (ids.length === 0) return;
    setSubmitting(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch(`/api/research/plans/${planId}/invite-from-pool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolMemberIds: ids }),
      });
      const data = (await res.json().catch(() => ({}))) as ServerResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? t("errInvitePool"));
      }
      setResponse(data);
      // Erfolgreich (invited / schon-eingeladen / Duplikat) eingeladene IDs
      // lokal als eingeladen markieren, damit sie deaktiviert sind.
      const handled = (data.results ?? [])
        .filter((r) => r.status === "invited" || r.status === "already_invited")
        .map((r) => r.poolMemberId);
      setInvited((cur) => new Set([...cur, ...handled]));
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errInvitePool"));
    } finally {
      setSubmitting(false);
    }
  }

  if (poolMembers.length === 0) {
    return (
      <p className="text-small text-neutral-500">
        {t("poolEmpty")}{" "}
        <Link
          href="/dashboard/research-plans/pool"
          className="text-body-strong text-primary-700 hover:underline"
        >
          {t("poolMaintain")}
        </Link>
      </p>
    );
  }

  const selectedCount = [...selected].filter((id) => !invited.has(id)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-caption text-neutral-500">
          {t.rich("poolSelectIntro", {
            link: (chunks) => (
              <Link
                href="/dashboard/research-plans/pool"
                className="underline hover:text-neutral-900"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-small">
            <span className="mb-1 block text-caption text-neutral-500">
              {t("filterRole")}
            </span>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className={FIELD_INPUT_CLASS}
            >
              <option value={ALL}>{tc("all")}</option>
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="text-small">
            <span className="mb-1 block text-caption text-neutral-500">
              {t("filterSegment")}
            </span>
            <select
              value={filterSegment}
              onChange={(e) => setFilterSegment(e.target.value)}
              className={FIELD_INPUT_CLASS}
            >
              <option value={ALL}>{tc("all")}</option>
              {segments.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto rounded-md border border-neutral-200">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2">
          <input
            type="checkbox"
            checked={allSelectableChecked}
            onChange={toggleAll}
            disabled={submitting || selectableIds.length === 0}
            aria-label={t("selectAllAria")}
          />
          <span className="text-caption text-neutral-500">
            {t("shownSelectable", {
              shown: filtered.length,
              selectable: selectableIds.length,
            })}
          </span>
        </div>
        <ul>
          {filtered.map((m) => {
            const isInvited = invited.has(m.id);
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 border-b border-neutral-100 px-3 py-2 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={() => toggle(m.id)}
                  disabled={isInvited || submitting}
                  aria-label={t("selectAria", { name: m.contactLabel })}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-body-strong text-neutral-900">{m.contactLabel}</span>
                    {isInvited && (
                      <span className="text-caption text-success-700">
                        {t("invitedMark")}
                      </span>
                    )}
                  </div>
                  <div className="text-caption text-neutral-500">
                    {m.contactEmail ?? t("noEmailShort")}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  {m.role && <Badge variant="default">{m.role}</Badge>}
                  {m.segment && <Badge variant="low">{m.segment}</Badge>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleInvite} disabled={submitting || selectedCount === 0}>
          {submitting
            ? t("poolSubmitInviting")
            : selectedCount === 0
              ? t("poolSubmitSelect")
              : t("poolSubmitInviteN", { count: selectedCount })}
        </Button>
        <span className="text-small text-neutral-500">
          {t("poolSubmitHelp")}
        </span>
      </div>

      {response?.results && response.summary && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-small">
          <div className="mb-2 font-medium text-neutral-900">
            {t("summaryPool", {
              invited: response.summary.invited,
              skipped: response.summary.skipped,
              errors: response.summary.errors,
            })}
          </div>
          <ul className="space-y-0.5">
            {response.results.map((r) => (
              <li key={r.poolMemberId} className={STATUS_TEXT_CLASS[r.status]}>
                <span className="font-medium">{t(STATUS_LABEL_KEY[r.status])}</span>
                {" — "}
                {r.contactLabel}
                {r.message ? ` (${r.message})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
