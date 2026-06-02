"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { InterviewTurn } from "@/lib/voice-agent/interviewer";

type Status = "open" | "completed" | "abandoned";

interface SessionView {
  status: Status;
  conversation: InterviewTurn[];
  company: string | null;
}

interface InterviewChatProps {
  token: string;
  initialConversation: InterviewTurn[];
  initialStatus: Status;
  company: string | null;
  /** Drop Findr branding from the chrome — used by the research flow where
   *  the participant is the customer of a Findr customer and has no
   *  relationship with Findr. When true:
   *    - the "findr." wordmark in the top bar is hidden,
   *    - the bottom-of-input caption replaces "Powered by findr. · …"
   *      with a neutral "Confidential research interview." line.
   *  Defaults to false so post_loss / checkin renders unchanged. */
  brandless?: boolean;
  /** When set, used as the h1 in place of the default
   *  "A short conversation [about ${company}]". The research page passes
   *  the research-plan title here; if absent it falls back to a generic
   *  "Research interview". For post_loss / checkin this stays null and the
   *  original company-aware heading is rendered. */
  headingOverride?: string | null;
  /** White-label (research only). When a Findr customer has set branding, the
   *  brandless research header shows their logo/name instead of staying empty,
   *  and the accent color overrides the default violet. All null → byte-
   *  identical neutral fallback (today's behavior). */
  brandName?: string | null;
  /** #RRGGBB accent; null → default Findr violet (#5B2FD4). */
  accentColor?: string | null;
  /** Public logo URL; null → fall back to the text brand name (or nothing). */
  logoUrl?: string | null;
  /** Panel-Anbieter E2: die fertig aufgebaute Complete-Return-URL des Anbieters.
   *  Wenn gesetzt (nur Panel-Sessions), leitet CompletedPanel den Browser dorthin
   *  zurück, sobald das Interview abgeschlossen ist. Null für JEDE Nicht-Panel-
   *  Session → der bestehende Dank-Screen, KEIN Redirect (byte-identisch). */
  panelCompleteRedirect?: string | null;
}

/** Default Findr accent — fallback when no org accent color is set. */
const DEFAULT_ACCENT = "#5B2FD4";
/** Only ever apply a caller-supplied accent if it's a strict #RRGGBB hex. */
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const FONT = "var(--font-inter), Inter, system-ui, -apple-system, sans-serif";

function Bubble({ role, text }: { role: InterviewTurn["role"]; text: string }) {
  const isAgent = role === "agent";
  return (
    <div className={`flex ${isAgent ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
          isAgent
            ? "rounded-tl-sm bg-[#F4F1FD] text-[#0E0A1F]"
            : "rounded-tr-sm bg-[var(--brand-accent)] text-white"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-tl-sm bg-[#F4F1FD] px-4 py-3">
        <span className="flex items-center gap-1">
          {["0ms", "150ms", "300ms"].map((d) => (
            <span
              key={d}
              className="inline-block h-[6px] w-[6px] animate-bounce rounded-full bg-[var(--brand-accent)]"
              style={{ animationDelay: d }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

function CompletedPanel({
  redirectUrl = null,
}: {
  /** Panel-Anbieter E2: wenn gesetzt, wird der Teilnehmer beim Mount (= Interview
   *  abgeschlossen) zur Anbieter-Complete-URL zurückgeleitet. Der Dank-Screen ist
   *  dann nur ein kurzer Fallback (z. B. falls die Navigation scheitert). Null →
   *  reiner Dank-Screen, byte-identisch zu heute. */
  redirectUrl?: string | null;
}) {
  const t = useTranslations("interview");
  useEffect(() => {
    if (redirectUrl) window.location.href = redirectUrl;
  }, [redirectUrl]);
  return (
    <div className="mb-10 mt-8 rounded-2xl border border-[#E8E4F2] bg-[#FAFAFE] px-6 py-8 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#2E9E6B] text-[18px] text-white">
        ✓
      </div>
      <h2 className="text-[18px] font-semibold text-[#0E0A1F]">
        {t("completed.title")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[#6B6680]">
        {t("completed.body")}
      </p>
    </div>
  );
}

export function InterviewChat({
  token,
  initialConversation,
  initialStatus,
  company,
  brandless = false,
  headingOverride = null,
  brandName = null,
  accentColor = null,
  logoUrl = null,
  panelCompleteRedirect = null,
}: InterviewChatProps) {
  const t = useTranslations("interview");
  const locale = useLocale();

  // Accent flows down as a CSS custom property on the root wrapper; the inline
  // bg-[var(--brand-accent)] utilities (incl. the module-level Bubble /
  // TypingBubble) read it via the cascade. Guarded to strict hex so a bad value
  // can never inject into the style attribute.
  const accent =
    accentColor && HEX_COLOR.test(accentColor) ? accentColor : DEFAULT_ACCENT;
  // White-label brand chrome only applies to the brandless (research) surface.
  const hasBrand = brandless && Boolean(logoUrl || brandName);
  const [messages, setMessages] = useState<InterviewTurn[]>(initialConversation);
  const [status, setStatus] = useState<Status>(initialStatus);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const isOpen = status === "open";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading || !isOpen) return;

    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "customer", text }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/interview/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? t("error.requestFailed"));
      }
      const data = (await res.json()) as { session: SessionView };
      setMessages(data.session.conversation);
      setStatus(data.session.status);
    } catch (err) {
      // Roll back the optimistic message and let the buyer resend.
      setMessages((prev) =>
        prev.filter(
          (m, i) =>
            !(i === prev.length - 1 && m.role === "customer" && m.text === text),
        ),
      );
      setInput(text);
      setError(err instanceof Error ? err.message : t("error.generic"));
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div
      lang={locale}
      style={{ fontFamily: FONT, "--brand-accent": accent } as React.CSSProperties}
      className="flex min-h-screen w-full flex-col bg-white text-[#0E0A1F]"
    >
      <header className="border-b border-[#E8E4F2] px-5 py-4">
        <div
          className={`mx-auto flex max-w-2xl items-center ${
            brandless && !hasBrand ? "justify-center" : "justify-between"
          }`}
        >
          {!brandless && (
            <span className="flex items-center text-[20px] font-extrabold tracking-[-0.02em] text-[#0E0A1F]">
              findr
              <span className="mb-[10px] ml-[1px] inline-block h-[4px] w-[4px] rounded-full bg-[#B00]" />
            </span>
          )}
          {hasBrand &&
            (logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={brandName ?? ""}
                className="h-7 w-auto max-w-[180px] object-contain"
              />
            ) : (
              <span className="text-[20px] font-extrabold tracking-[-0.02em] text-[#0E0A1F]">
                {brandName}
              </span>
            ))}
          <span className="text-[12px] text-[#6B6680]">
            {t("header.confidential")}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-6">
        <div className="mb-6">
          <h1 className="text-[18px] font-semibold">
            {headingOverride
              ? headingOverride
              : brandless
                ? t("header.titleResearch")
                : company
                  ? t("header.titleWithCompany", { company })
                  : t("header.title")}
          </h1>
          <p className="mt-1 text-[14px] leading-relaxed text-[#6B6680]">
            {t("header.subtitle")}
          </p>
        </div>

        <div className="flex-1 space-y-4">
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.text} />
          ))}
          {loading && <TypingBubble />}
          <div ref={endRef} />
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-[#FFD7D0] bg-[#FFF3F1] px-4 py-2 text-[13px] text-[#C9442F]">
            {error}
          </div>
        )}

        {isOpen ? (
          <div className="sticky bottom-0 mt-6 bg-white pb-6 pt-2">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={loading}
                rows={1}
                placeholder={t("input.placeholder")}
                className="max-h-40 min-h-[46px] flex-1 resize-none rounded-xl border border-[#E8E4F2] px-4 py-3 text-[15px] outline-none transition-colors focus:border-[var(--brand-accent)] disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                className={`h-[46px] shrink-0 rounded-xl bg-[var(--brand-accent)] px-5 text-[14px] font-medium text-white disabled:opacity-50 ${
                  accent === DEFAULT_ACCENT
                    ? "transition-colors hover:bg-[#4A22B0]"
                    : "transition-opacity hover:opacity-90"
                }`}
              >
                {loading ? "…" : t("input.send")}
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-[#9B9BA3]">
              {brandless ? t("footer.brandless") : t("footer.default")}
            </p>
          </div>
        ) : (
          <CompletedPanel redirectUrl={panelCompleteRedirect} />
        )}
      </main>
    </div>
  );
}
