"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/**
 * Per-invite "Link kopieren" button on the plan-detail page. Pure utility —
 * does NOT mutate the invite, does NOT touch the invite-orchestration or
 * getPublicSession flow. The token is already on the invite row (set by
 * Migration 20260615); this component just exposes the resulting public
 * interview URL as a clipboard handle so the Findr user can share it
 * through any channel without going to the DB.
 *
 * The full URL is built on the server side via researchInterviewUrl() so
 * the env-resolution (NEXT_PUBLIC_APP_URL → VERCEL_URL → localhost) stays
 * centralized with the mail templates. This client component receives the
 * resolved string as a prop — never re-derives it.
 *
 * `link === null` covers old invite rows from before the access_token
 * migration (defensive — Migration 20260615 backfills, but persisted-DB
 * edge cases stay safe). In that case we render an em-dash placeholder
 * instead of a disabled button, matching the visual style of the other
 * "no data" cells in the table (Email column does the same).
 */

interface CopyInterviewLinkButtonProps {
  /** Pre-built public interview URL ({base}/interview/{access_token}).
   *  null when the invite has no access_token yet — placeholder rendered
   *  instead of a button. */
  link: string | null;
}

export function CopyInterviewLinkButton({
  link,
}: CopyInterviewLinkButtonProps) {
  const t = useTranslations("research.plans");
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Hold the timer in a ref so the cleanup effect can clear it on unmount
  // (e.g. a router.refresh() landing while the "Kopiert!" badge is still up)
  // and a fast double-click doesn't leave a stale timer racing the state.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!link) {
    return (
      <span className="text-caption text-neutral-400" aria-label={t("noLinkAria")}>
        —
      </span>
    );
  }

  async function copy() {
    if (!link) return;
    setError(null);
    try {
      // navigator.clipboard requires a secure context (https / localhost).
      // The dashboard is served behind auth + https, so this is the
      // expected path. Older browsers / non-secure contexts surface a
      // visible error rather than a silent no-op.
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast(t("copiedToast"));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(t("copyError"));
    }
  }

  return (
    <div className="space-y-1">
      <Button
        variant="secondary"
        size="sm"
        onClick={copy}
        aria-label={t("copyAria")}
      >
        {copied ? t("copied") : t("copyLink")}
      </Button>
      {error && (
        <div className="text-caption text-danger-700">{error}</div>
      )}
    </div>
  );
}
