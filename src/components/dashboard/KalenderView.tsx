"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FIELD_INPUT_CLASS } from "@/components/ui/Field";
import { toBcp47 } from "@/i18n/locale";
import {
  activationBucket,
  displayDayKey,
  formatActivationDateTime,
  relativeActivation,
  type ActivationBucket,
} from "@/lib/scheduler/datetime";

/**
 * Interactive month calendar for the Studien-Zeitplaner (Kalender-Redesign).
 *
 * A real month grid (Monday-first) is the hero — scheduled / running / completed
 * studies appear as colour-coded chips on their day, today is highlighted, and a
 * compact "Demnächst" list sits below. A toggle switches to the list agenda. A
 * click on an (today-or-future) empty day opens a quick-schedule dialog to plan a
 * draft study right there.
 *
 * Hydration: every "now"-dependent value derives from the `nowIso` PROP (the
 * server's render instant), never Date.now() in this client render — so SSR and
 * hydration are identical. Calendar-day math uses new Date(y,m,d) (deterministic,
 * argful → not the impure argless new Date()). Display timezone is Europe/Berlin
 * (datetime.ts), matching the activation emails.
 */

type EventKind = "scheduled" | "live" | "done";

export interface CalendarEvent {
  id: string;
  title: string;
  dateIso: string;
  kind: EventKind;
}

export interface DraftOption {
  id: string;
  title: string;
}

interface KalenderViewProps {
  events: CalendarEvent[];
  drafts: DraftOption[];
  nowIso: string;
  locale: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayKeyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Tailwind chip styles per visual kind (existing design tokens only). */
const KIND_STYLE: Record<
  "scheduled" | "overdue" | "live" | "done",
  { chip: string; dot: string }
> = {
  scheduled: { chip: "bg-primary-50 text-primary-700", dot: "bg-primary-600" },
  overdue: { chip: "bg-warning-50 text-warning-700", dot: "bg-warning-500" },
  live: { chip: "bg-success-50 text-success-700", dot: "bg-success-500" },
  done: { chip: "bg-neutral-100 text-neutral-500", dot: "bg-neutral-400" },
};

function visualKind(
  ev: CalendarEvent,
  nowMs: number,
): "scheduled" | "overdue" | "live" | "done" {
  if (ev.kind === "scheduled") {
    return new Date(ev.dateIso).getTime() < nowMs ? "overdue" : "scheduled";
  }
  return ev.kind;
}

export function KalenderView({
  events,
  drafts,
  nowIso,
  locale,
}: KalenderViewProps) {
  const router = useRouter();
  const t = useTranslations("kalender");
  const bcp = toBcp47(locale);

  // All "now" derives from the prop → identical on server + client.
  const nowMs = useMemo(() => new Date(nowIso).getTime(), [nowIso]);
  const todayKey = useMemo(() => displayDayKey(nowMs), [nowMs]);

  const [view, setView] = useState<"month" | "agenda">("month");
  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayKey.split("-").map(Number);
    return { year: y, month: m - 1 };
  });

  // Quick-schedule dialog state.
  const [quickDay, setQuickDay] = useState<string | null>(null);
  const [pickId, setPickId] = useState("");
  const [pickTime, setPickTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quickDay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQuickDay(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickDay]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = displayDayKey(new Date(ev.dateIso).getTime());
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const offset = (first.getDay() + 6) % 7; // Monday = 0
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(cursor.year, cursor.month, 1 - offset + i);
      const key = dayKeyOf(d.getFullYear(), d.getMonth(), d.getDate());
      return {
        key,
        day: d.getDate(),
        inMonth: d.getMonth() === cursor.month,
        isToday: key === todayKey,
        isPast: key < todayKey,
        events: eventsByDay.get(key) ?? [],
      };
    });
  }, [cursor, todayKey, eventsByDay]);

  const monthLabel = new Intl.DateTimeFormat(bcp, {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(new Date(cursor.year, cursor.month, 1, 12));

  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        // 2024-01-01 is a Monday → seven consecutive short weekday names.
        new Intl.DateTimeFormat(bcp, { weekday: "short" }).format(
          new Date(2024, 0, 1 + i),
        ),
      ),
    [bcp],
  );

  const upcoming = useMemo(
    () =>
      events
        .filter(
          (e) => e.kind === "scheduled" && new Date(e.dateIso).getTime() >= nowMs,
        )
        .sort((a, b) => (a.dateIso < b.dateIso ? -1 : 1))
        .slice(0, 4),
    [events, nowMs],
  );

  function goStudy(id: string) {
    router.push(`/dashboard/market-research/${id}`);
  }

  function openQuick(dayKey: string) {
    setError(null);
    setPickId(drafts[0]?.id ?? "");
    setPickTime("09:00");
    setQuickDay(dayKey);
  }

  async function submitQuick() {
    if (!quickDay || !pickId) {
      setError(t("quick.errPick"));
      return;
    }
    const iso = new Date(`${quickDay}T${pickTime}`);
    if (Number.isNaN(iso.getTime())) {
      setError(t("errPickDate"));
      return;
    }
    if (iso.getTime() <= Date.now()) {
      setError(t("errFutureDate"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/research/plans/${pickId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledActivationAt: iso.toISOString() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("errSaveSchedule"));
      setQuickDay(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errSaveSchedule"));
    } finally {
      setBusy(false);
    }
  }

  function prevMonth() {
    setCursor((c) =>
      c.month === 0
        ? { year: c.year - 1, month: 11 }
        : { year: c.year, month: c.month - 1 },
    );
  }
  function nextMonth() {
    setCursor((c) =>
      c.month === 11
        ? { year: c.year + 1, month: 0 }
        : { year: c.year, month: c.month + 1 },
    );
  }
  function goToday() {
    const [y, m] = todayKey.split("-").map(Number);
    setCursor({ year: y, month: m - 1 });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: month nav + Heute + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            aria-label={t("a11y.prevMonth")}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span className="min-w-[150px] text-center text-h3 font-medium text-neutral-900">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            aria-label={t("a11y.nextMonth")}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
          </button>
          <button
            type="button"
            onClick={goToday}
            className="ml-1 h-8 rounded-md border border-neutral-200 px-3 text-small font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            {t("todayBtn")}
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-md bg-neutral-100 p-1">
          {(["month", "agenda"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded px-3 py-1 text-small font-medium transition-colors ${
                view === v
                  ? "bg-card text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {t(v === "month" ? "view.month" : "view.agenda")}
            </button>
          ))}
        </div>
      </div>

      {view === "month" ? (
        <>
          <Card className="p-3">
            <div className="mb-2 grid grid-cols-7 gap-1.5">
              {weekdays.map((wd, i) => (
                <div
                  key={i}
                  className="text-center text-caption font-medium uppercase tracking-wide text-neutral-400"
                >
                  {wd}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((cell) => {
                const clickable = !cell.isPast;
                return (
                  <div
                    key={cell.key}
                    onClick={clickable ? () => openQuick(cell.key) : undefined}
                    className={`flex min-h-[78px] flex-col gap-1 rounded-md border p-1.5 ${
                      cell.isToday
                        ? "border-primary-300 bg-primary-50/40"
                        : "border-neutral-100"
                    } ${cell.inMonth ? "" : "opacity-40"} ${
                      clickable ? "cursor-pointer transition-colors hover:border-neutral-300" : ""
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center self-start rounded-full text-caption ${
                        cell.isToday
                          ? "bg-primary-600 font-medium text-white"
                          : "text-neutral-500"
                      }`}
                    >
                      {cell.day}
                    </span>
                    {cell.events.slice(0, 2).map((ev) => {
                      const k = visualKind(ev, nowMs);
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            goStudy(ev.id);
                          }}
                          title={ev.title}
                          className={`truncate rounded px-1.5 py-0.5 text-left text-caption ${KIND_STYLE[k].chip}`}
                        >
                          {ev.title}
                        </button>
                      );
                    })}
                    {cell.events.length > 2 && (
                      <span className="pl-1 text-caption text-neutral-400">
                        {t("moreEvents", { count: cell.events.length - 2 })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-caption text-neutral-400">
            {(
              [
                ["scheduled", t("legend.scheduled")],
                ["live", t("legend.live")],
                ["overdue", t("legend.overdue")],
                ["done", t("legend.done")],
              ] as const
            ).map(([k, label]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-sm ${KIND_STYLE[k].dot}`} />
                {label}
              </span>
            ))}
          </div>

          {/* Demnächst */}
          <div className="border-t border-neutral-100 pt-4">
            <p className="mb-2 text-body-strong text-neutral-700">
              {t("upcomingTitle")}
            </p>
            {upcoming.length === 0 ? (
              <p className="text-small text-neutral-400">{t("upcomingEmpty")}</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => goStudy(ev.id)}
                    className="flex w-full items-center gap-3 rounded-md border border-neutral-100 px-3 py-2 text-left transition-colors hover:bg-neutral-50"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary-600" />
                    <span className="w-32 shrink-0 text-small font-medium text-neutral-700">
                      {formatActivationDateTime(ev.dateIso, locale)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body text-neutral-900">
                      {ev.title}
                    </span>
                    <span className="shrink-0 text-caption text-neutral-400">
                      {relativeActivation(ev.dateIso, locale, nowMs)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <AgendaView
          events={events}
          nowMs={nowMs}
          locale={locale}
          onOpen={goStudy}
          t={t}
        />
      )}

      {/* Quick-schedule dialog */}
      {quickDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setQuickDay(null)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="text-h3 text-neutral-900">{t("quick.title")}</h2>
            <p className="mt-1 text-small text-neutral-500">
              {t("quick.on", {
                date: new Intl.DateTimeFormat(bcp, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "Europe/Berlin",
                }).format(new Date(`${quickDay}T12:00`)),
              })}
            </p>

            {drafts.length === 0 ? (
              <div className="mt-4 space-y-3">
                <p className="text-small text-neutral-500">
                  {t("quick.noDrafts")}
                </p>
                <Link
                  href="/dashboard/market-research/new"
                  className="inline-flex h-9 items-center rounded-md bg-primary-600 px-4 text-body-strong font-medium text-white transition-colors hover:bg-primary-hover"
                >
                  {t("quick.noDraftsCta")}
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="qs-study"
                    className="mb-1 block text-small text-neutral-600"
                  >
                    {t("quick.pickStudy")}
                  </label>
                  <select
                    id="qs-study"
                    value={pickId}
                    onChange={(e) => setPickId(e.target.value)}
                    disabled={busy}
                    className={FIELD_INPUT_CLASS}
                  >
                    {drafts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="qs-time"
                    className="mb-1 block text-small text-neutral-600"
                  >
                    {t("quick.timeLabel")}
                  </label>
                  <input
                    id="qs-time"
                    type="time"
                    value={pickTime}
                    onChange={(e) => setPickTime(e.target.value)}
                    disabled={busy}
                    className={`${FIELD_INPUT_CLASS} max-w-[10rem]`}
                  />
                </div>
                {error && (
                  <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
                    {error}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="ghost"
                    onClick={() => setQuickDay(null)}
                    disabled={busy}
                  >
                    {t("cancel")}
                  </Button>
                  <Button onClick={submitQuick} disabled={busy}>
                    {busy ? t("saving") : t("quick.confirm")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Agenda (list) view — the toggle alternative ───────────────────────────────

const BUCKET_ORDER: ActivationBucket[] = [
  "past",
  "today",
  "tomorrow",
  "thisWeek",
  "later",
];

function AgendaView({
  events,
  nowMs,
  locale,
  onOpen,
  t,
}: {
  events: CalendarEvent[];
  nowMs: number;
  locale: string;
  onOpen: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const scheduled = events
    .filter((e) => e.kind === "scheduled")
    .sort((a, b) => (a.dateIso < b.dateIso ? -1 : 1));
  const running = events.filter((e) => e.kind === "live");

  const byBucket = new Map<ActivationBucket, CalendarEvent[]>();
  for (const ev of scheduled) {
    const b = activationBucket(ev.dateIso, nowMs);
    byBucket.set(b, [...(byBucket.get(b) ?? []), ev]);
  }

  const row = (ev: CalendarEvent, dotClass: string, meta: string) => (
    <button
      key={ev.id}
      type="button"
      onClick={() => onOpen(ev.id)}
      className="flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-neutral-50"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
      <span className="min-w-0 flex-1 truncate text-body-strong text-neutral-900">
        {ev.title}
      </span>
      <span className="shrink-0 text-small text-neutral-500">{meta}</span>
    </button>
  );

  const hasScheduled = scheduled.length > 0;

  return (
    <div className="space-y-6">
      {BUCKET_ORDER.map((bucket) => {
        const items = byBucket.get(bucket);
        if (!items || items.length === 0) return null;
        const overdue = bucket === "past";
        return (
          <section key={bucket} className="space-y-2">
            <h3 className="text-body-strong text-neutral-700">
              {t(`bucket.${bucket}`)}
            </h3>
            <Card>
              {items.map((ev) =>
                row(
                  ev,
                  overdue ? "bg-warning-500" : "bg-primary-600",
                  formatActivationDateTime(ev.dateIso, locale),
                ),
              )}
            </Card>
          </section>
        );
      })}

      {running.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-body-strong text-neutral-700">
            {t("sectionRunning")}
          </h3>
          <Card>
            {running.map((ev) => row(ev, "bg-success-500", t("runningLabel")))}
          </Card>
        </section>
      )}

      {!hasScheduled && running.length === 0 && (
        <p className="text-small text-neutral-400">{t("upcomingEmpty")}</p>
      )}
    </div>
  );
}
