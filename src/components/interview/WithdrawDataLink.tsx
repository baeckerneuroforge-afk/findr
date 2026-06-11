"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * DSGVO-Selbstwiderruf (G6) — diskreter, persistenter Link unter dem Interview-
 * Header (sichtbar während UND nach dem Gespräch). Löscht die eigene Session
 * über POST /api/interview/[token]/withdraw (capability-auth via Token). Nach
 * Erfolg ersetzt eine Bestätigung den Link; die Seite wird NICHT neu geladen,
 * da die Session dann serverseitig weg ist (ein Reload liefe in notFound).
 */
export function WithdrawDataLink({ token }: { token: string }) {
  const t = useTranslations("interview");
  const [state, setState] = useState<"idle" | "working" | "done">("idle");

  async function handleWithdraw() {
    if (!window.confirm(t("withdraw.confirm"))) return;
    setState("working");
    try {
      await fetch(`/api/interview/${token}/withdraw`, { method: "POST" });
    } catch {
      // Idempotent + kein Orakel: selbst bei Netzfehler zeigen wir den
      // Done-Zustand; ein Retry ist gefahrlos. Der Server ist die Wahrheit.
    }
    setState("done");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pt-2 text-right">
      {state === "done" ? (
        <span className="text-[11px] text-[#6B6680]">{t("withdraw.done")}</span>
      ) : (
        <button
          type="button"
          onClick={handleWithdraw}
          disabled={state === "working"}
          className="text-[11px] text-[#6B6680] underline underline-offset-2 transition-colors hover:text-[#0E0A1F] disabled:opacity-50"
        >
          {state === "working" ? t("withdraw.working") : t("withdraw.link")}
        </button>
      )}
    </div>
  );
}
