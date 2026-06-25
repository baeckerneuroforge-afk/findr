"use client";

import { useState } from "react";
import { Card, CheckIcon, ChoiceCard, GhostButton } from "../ui";

/**
 * Nach „Studie starten": EIN geführter Verteilungs-Screen statt der heute über
 * die Detailseite verstreuten 5 Panels (Open-Link / Pool / E-Mail / Prolific /
 * Synthetic). Screening ist kein eigener Wall mehr, sondern erscheint als ruhiger
 * Inline-Hinweis nur dort, wo es gebraucht wird (Open-Link, Panel).
 */

type Channel = "open_link" | "pool" | "email" | "prolific";

const CHANNELS: {
  id: Channel;
  title: string;
  desc: string;
  badge?: string;
  needsScreening?: boolean;
}[] = [
  {
    id: "open_link",
    title: "Öffentlicher Link",
    desc: "Anonyme Teilnahme über einen Link — schnelle Reichweite",
    badge: "Empfohlen",
    needsScreening: true,
  },
  {
    id: "pool",
    title: "Aus deinem Panel",
    desc: "Personen aus deinem gespeicherten Teilnehmer-Pool einladen",
  },
  {
    id: "email",
    title: "Per E-Mail einladen",
    desc: "Einzeln oder als CSV-Liste verschicken",
  },
  {
    id: "prolific",
    title: "Prolific-Panel",
    desc: "Externe Stichprobe über Prolific rekrutieren",
    needsScreening: true,
  },
];

export function Distribution({
  title,
  onRestart,
}: {
  title: string;
  onRestart: () => void;
}) {
  const [channel, setChannel] = useState<Channel | null>("open_link");
  const active = CHANNELS.find((c) => c.id === channel);

  return (
    <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white">
          <CheckIcon className="h-4 w-4" />
        </span>
        <p className="text-caption font-medium uppercase tracking-wide text-primary-600">
          Studie erstellt
        </p>
      </div>
      <h1 className="mt-3 text-display text-neutral-900">
        Wie willst du Teilnehmer:innen gewinnen?
      </h1>
      <p className="mt-2 max-w-[52ch] text-body text-neutral-500">
        „{title}“ ist angelegt. Wähl einen Weg — du kannst später weitere
        hinzufügen.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {CHANNELS.map((c) => (
          <ChoiceCard
            key={c.id}
            selected={channel === c.id}
            onSelect={() => setChannel(c.id)}
            title={c.title}
            desc={c.desc}
            badge={c.badge}
          />
        ))}
      </div>

      {active ? (
        <Card className="mt-4">
          {active.id === "open_link" ? (
            <div>
              <p className="text-small font-medium text-neutral-700">
                Dein öffentlicher Interview-Link
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-small text-neutral-500">
                  klymeo.com/interview/open/familienrezepte-3f9k
                </code>
                <button
                  type="button"
                  className="rounded-lg border border-neutral-300 bg-card px-3 py-2 text-small font-medium text-neutral-600 hover:border-neutral-400"
                >
                  Kopieren
                </button>
              </div>
            </div>
          ) : null}
          {active.id === "pool" ? (
            <p className="text-small text-neutral-600">
              Wähle Segmente aus deinem Pool — z. B.{" "}
              <span className="font-medium text-neutral-800">
                Eltern · 25–45 · DE
              </span>{" "}
              (218 Personen).
            </p>
          ) : null}
          {active.id === "email" ? (
            <p className="text-small text-neutral-600">
              Füge Namen und E-Mail-Adressen ein (eine pro Zeile) oder lade eine
              CSV hoch — Klymeo verschickt die Einladungen.
            </p>
          ) : null}
          {active.id === "prolific" ? (
            <p className="text-small text-neutral-600">
              Geschätzte Kosten für 15 Interviews:{" "}
              <span className="font-medium text-neutral-800">≈ 112 €</span> · der
              Entwurf wird unveröffentlicht in deinem Prolific-Konto angelegt.
            </p>
          ) : null}

          {active.needsScreening ? (
            <p className="mt-3 rounded-lg bg-primary-50 px-3 py-2 text-caption text-primary-700">
              Tipp: Für diesen Weg lohnt sich ein kurzes Screening, damit nur
              passende Personen teilnehmen — optional in einem Schritt einrichtbar.
            </p>
          ) : null}
        </Card>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-4">
        <GhostButton onClick={onRestart}>Prototyp neu starten</GhostButton>
        <GhostButton onClick={() => undefined}>Später einrichten</GhostButton>
      </div>
    </div>
  );
}
