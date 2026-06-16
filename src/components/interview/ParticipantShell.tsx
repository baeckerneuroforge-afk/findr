"use client";

import { useLocale, useTranslations } from "next-intl";
import { FONT, resolveAccent } from "./branding";
import { KlymeoMark } from "@/components/shared/KlymeoMark";

/**
 * Branded full-page chrome for the participant-facing screening + rejection
 * screens. Mirrors InterviewChat's header + root exactly (same classes, same
 * `--brand-accent` custom property, same "Confidential" caption) so the
 * white-label rendering is consistent across all three participant screens.
 * InterviewChat keeps its own copy of this chrome (left untouched); this shell
 * serves the two NEW screens (ScreeningForm, RejectionPanel).
 *
 * Screening only ever runs on the research surface (brandless = true), where a
 * Klymeo customer's logo/name + accent replace the Klymeo chrome. Children render
 * inside the centered max-w-2xl main.
 */
export function ParticipantShell({
  brandName = null,
  accentColor = null,
  logoUrl = null,
  brandless = true,
  children,
}: {
  brandName?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  brandless?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("interview");
  const locale = useLocale();
  const accent = resolveAccent(accentColor);
  const hasBrand = brandless && Boolean(logoUrl || brandName);

  return (
    <div
      lang={locale}
      style={
        { fontFamily: FONT, "--brand-accent": accent } as React.CSSProperties
      }
      className="flex min-h-screen w-full flex-col bg-white text-[#221F2A]"
    >
      <header className="border-b border-[#DCDEEF] px-5 py-4">
        <div
          className={`mx-auto flex max-w-2xl items-center ${
            brandless && !hasBrand ? "justify-center" : "justify-between"
          }`}
        >
          {!brandless && (
            <span
              className="flex items-center gap-1.5 text-[20px] tracking-[-0.04em] text-[#221F2A]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
            >
              <KlymeoMark className="h-5 w-5 shrink-0" />
              Klymeo
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
              <span className="text-[20px] font-extrabold tracking-[-0.02em] text-[#221F2A]">
                {brandName}
              </span>
            ))}
          <span className="text-[12px] text-[#6B6678]">
            {t("header.confidential")}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-6">
        {children}
      </main>
    </div>
  );
}
