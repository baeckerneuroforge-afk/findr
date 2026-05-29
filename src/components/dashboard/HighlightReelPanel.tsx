"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/**
 * Highlight-Reel Panel auf der Synthese-Seite.
 *
 * Posts to /api/research/plans/[id]/highlights — compute-on-demand. The
 * trigger is a single click; the panel does NOT auto-fetch on mount because
 * each request is an Opus call. After a successful response the reel stays
 * in component state until the page navigates away (no persistence — same
 * v1 simplicity as ChatWithDataPanel's chat history).
 *
 * Anti-hallu contract is enforced server-side (the engine drops paraphrased
 * quotes / unknown ids / unknown themeRefs and short-circuits to an empty
 * reel without spending tokens when there's nothing to quote). The UI
 * surfaces a) the highlights as quote-cards in the style of
 * SynthesisThemeCard, b) the engine's optional summary (small grey note),
 * c) an "honest empty" state when highlights.length === 0.
 *
 * Stil: SynthesisThemeCard — neutral border, italic Zitat, mono Quell-IDs.
 * i18n: deutsch.
 */

interface Highlight {
  quote: string;
  interviewId: string;
  themeRef: string;
  caption: string;
}

interface HighlightReel {
  highlights: Highlight[];
  summary?: string;
}

interface HighlightReelPanelProps {
  planId: string;
  /** Mirror of ChatWithDataPanel's `ready` — the synthesis row exists with
   *  `synthesized_at` set. False disables the trigger and shows a small
   *  hint instead of the button. */
  ready: boolean;
}

export function HighlightReelPanel({ planId, ready }: HighlightReelPanelProps) {
  const t = useTranslations("research.synthesis");
  const [reel, setReel] = useState<HighlightReel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch(
        `/api/research/plans/${planId}/highlights`,
        { method: "POST" },
      );
      if (!resp.ok) {
        const body: { error?: string; detail?: string } = await resp
          .json()
          .catch(() => ({}));
        setError(
          body.detail ?? body.error ?? t("errStatus", { status: resp.status }),
        );
        setReel(null);
        return;
      }
      const body: { success: boolean; reel: HighlightReel } = await resp.json();
      setReel(body.reel);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errReel"));
      setReel(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-h3 text-neutral-900">{t("reelTitle")}</h2>
            <p className="mt-1 text-small text-neutral-500">
              {t("reelSubtitle")}
            </p>
          </div>
          {ready && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-md border border-primary-300 bg-primary-50 px-4 py-2 text-small font-medium text-primary-800 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? t("reelGenerating")
                : reel
                  ? t("reelRegenerate")
                  : t("reelGenerate")}
            </button>
          )}
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {!ready && (
          <p className="text-small italic text-neutral-500">
            {t("reelNotReady")}
          </p>
        )}

        {error && (
          <p className="text-small text-danger-700">{error}</p>
        )}

        {ready && !reel && !loading && !error && (
          <p className="text-small text-neutral-500">{t("reelPrompt")}</p>
        )}

        {reel && (
          <ReelBody reel={reel} />
        )}
      </CardBody>
    </Card>
  );
}

function ReelBody({ reel }: { reel: HighlightReel }) {
  const t = useTranslations("research.synthesis");
  if (reel.highlights.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-small italic text-neutral-500">{t("reelEmpty")}</p>
        {reel.summary && (
          <p className="text-small text-neutral-500">{reel.summary}</p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {reel.summary && (
        <p className="text-small text-neutral-600">{reel.summary}</p>
      )}
      <ul className="space-y-3">
        {reel.highlights.map((h, i) => (
          <HighlightCard key={`h-${i}`} highlight={h} />
        ))}
      </ul>
    </div>
  );
}

function HighlightCard({ highlight }: { highlight: Highlight }) {
  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-5">
      <p className="border-l-2 border-primary-300 pl-4 text-body italic leading-relaxed text-neutral-800">
        „{highlight.quote}"
      </p>
      <p className="mt-3 text-small text-neutral-600">
        {highlight.caption}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption">
        <span className="rounded bg-primary-50 px-2 py-0.5 font-medium uppercase tracking-wider text-primary-700">
          {highlight.themeRef}
        </span>
        <span className="font-mono text-neutral-500">
          {highlight.interviewId}
        </span>
      </div>
    </li>
  );
}
