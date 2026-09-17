import Image from "next/image";
import type { Locale } from "@/i18n/marketing-locale";
import {
  TRUSTED_BY_COPY,
  TRUSTED_BY_CUSTOMER,
  TRUSTED_BY_HREF,
  TRUSTED_BY_MARK_SRC,
} from "@/lib/marketing/trusted-by";

/**
 * Post-hero social-proof band. One real customer, treated as a colophon
 * (broken rule + plate + caption) instead of a fake logo wall. Server
 * Component — no cookies/headers/searchParams.
 */
export function TrustedBy({ lang = "de" }: { lang?: Locale }) {
  const copy = TRUSTED_BY_COPY[lang];
  const label = `${copy.eyebrow} ${TRUSTED_BY_CUSTOMER}`;

  return (
    <section
      aria-label={label}
      className="border-y border-border bg-secondary/40"
    >
      <div className="mx-auto max-w-7xl px-6 py-10 md:py-12">
        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-border" aria-hidden />
          <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.28em] text-soul">
            {copy.eyebrow}
          </p>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>

        <div className="mt-6 flex flex-col items-center gap-4">
          <a
            href={TRUSTED_BY_HREF}
            target="_blank"
            rel="noreferrer"
            aria-label={label}
            className="group relative inline-flex items-center rounded-2xl border border-border bg-card px-10 py-5 shadow-[0_18px_40px_-28px_oklch(0.16_0.01_260_/_0.35)] transition duration-500 hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_22px_50px_-24px_oklch(0.72_0.16_55_/_0.35)]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-8 -bottom-px h-px bg-gradient-to-r from-transparent via-soul/70 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
            {/* Official yfood wordmark, self-hosted. SVG is not optimized by
                next/image — `unoptimized` keeps the vector intact. */}
            <Image
              src={TRUSTED_BY_MARK_SRC}
              alt={copy.markAlt}
              width={99}
              height={31}
              unoptimized
              className="h-9 w-auto md:h-11"
            />
          </a>
          <p className="text-sm text-muted-foreground">{copy.caption}</p>
        </div>
      </div>
    </section>
  );
}
