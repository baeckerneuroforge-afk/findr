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
}

const FONT = "var(--font-inter), Inter, system-ui, -apple-system, sans-serif";

function Bubble({ role, text }: { role: InterviewTurn["role"]; text: string }) {
  const isAgent = role === "agent";
  return (
    <div className={`flex ${isAgent ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
          isAgent
            ? "rounded-tl-sm bg-[#F4F1FD] text-[#0E0A1F]"
            : "rounded-tr-sm bg-[#5B2FD4] text-white"
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
              className="inline-block h-[6px] w-[6px] animate-bounce rounded-full bg-[#5B2FD4]"
              style={{ animationDelay: d }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

function CompletedPanel() {
  const t = useTranslations("interview");
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
}: InterviewChatProps) {
  const t = useTranslations("interview");
  const locale = useLocale();
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
      style={{ fontFamily: FONT }}
      className="flex min-h-screen w-full flex-col bg-white text-[#0E0A1F]"
    >
      <header className="border-b border-[#E8E4F2] px-5 py-4">
        <div
          className={`mx-auto flex max-w-2xl items-center ${
            brandless ? "justify-center" : "justify-between"
          }`}
        >
          {!brandless && (
            <span className="flex items-center text-[20px] font-extrabold tracking-[-0.02em] text-[#0E0A1F]">
              findr
              <span className="mb-[10px] ml-[1px] inline-block h-[4px] w-[4px] rounded-full bg-[#B00]" />
            </span>
          )}
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
                className="max-h-40 min-h-[46px] flex-1 resize-none rounded-xl border border-[#E8E4F2] px-4 py-3 text-[15px] outline-none transition-colors focus:border-[#5B2FD4] disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                className="h-[46px] shrink-0 rounded-xl bg-[#5B2FD4] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#4A22B0] disabled:opacity-50"
              >
                {loading ? "…" : t("input.send")}
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-[#9B9BA3]">
              {brandless ? t("footer.brandless") : t("footer.default")}
            </p>
          </div>
        ) : (
          <CompletedPanel />
        )}
      </main>
    </div>
  );
}
