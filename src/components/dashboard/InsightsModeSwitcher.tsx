"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { MissionControlPanel } from "./MissionControlPanel";
import { CrossStudyAgentPanel } from "./CrossStudyAgentPanel";

/**
 * Insights mode switcher (Bau 3). Toggles the /dashboard/insights surface between
 * the two cross-study tools and explains WHEN to use which:
 *   - "Chat"  → the existing Mission-Control chat panel (UNCHANGED): one fast
 *     question over ALL syntheses at once.
 *   - "Agent" → the new Cross-Study-Agent panel: multi-step research that loads
 *     studies on demand, counts exactly, and compares — slower but deeper.
 *
 * Both panels stay MOUNTED (the inactive one is `hidden`), so each keeps its own
 * session-local conversation when the user toggles back and forth. Neither panel
 * is modified; the switcher only hosts them and surfaces the distinction.
 */

interface StudyRef {
  studyId: string;
  studyTitle: string;
}

type Mode = "chat" | "agent";

export function InsightsModeSwitcher({ studies }: { studies: StudyRef[] }) {
  const t = useTranslations("crossStudyAgent");
  const [mode, setMode] = useState<Mode>("chat");

  const tab = (m: Mode, label: string) => (
    <button
      key={m}
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => setMode(m)}
      className={`rounded-md px-4 py-1.5 text-small font-medium transition-colors ${
        mode === m
          ? "bg-white text-neutral-900 shadow-sm"
          : "text-neutral-500 hover:text-neutral-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div>
        <div
          role="tablist"
          aria-label={t("modeAria")}
          className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1"
        >
          {tab("chat", t("modeChat"))}
          {tab("agent", t("modeAgent"))}
        </div>
        {/* The active mode's hint also contrasts it with the other, so the user
            knows when to reach for which. */}
        <p className="mt-2 max-w-2xl text-small text-neutral-500">
          {mode === "chat" ? t("chatHint") : t("agentHint")}
        </p>
      </div>

      {/* Both mounted; inactive hidden → each keeps its session thread. */}
      <div className={mode === "chat" ? "" : "hidden"}>
        <MissionControlPanel studies={studies} />
      </div>
      <div className={mode === "agent" ? "" : "hidden"}>
        <CrossStudyAgentPanel studies={studies} />
      </div>
    </div>
  );
}
