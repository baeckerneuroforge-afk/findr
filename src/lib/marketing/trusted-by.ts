/**
 * Homepage “Trusted by” strip — single source of copy + customer identity.
 * Both locale landings (`src/app/(site)/page.tsx`, `src/app/en/page.tsx`)
 * render this via <TrustedBy />; keep the name and labels here so a source
 * scan of the shipped files has one truth, not two paraphrases.
 *
 * Official brand spelling is lowercase **yfood** (yfood Labs GmbH).
 * Do not invent extra logos, quotes, or metrics.
 */
export const TRUSTED_BY_CUSTOMER = "yfood";

export const TRUSTED_BY_HREF = "https://yfood.com";

/** Self-hosted official wordmark (copied locally — never hotlinked). */
export const TRUSTED_BY_MARK_SRC = "/site/yfood-wordmark.svg";

export const TRUSTED_BY_COPY = {
  de: {
    eyebrow: "Im Einsatz bei",
    caption: "Unser erster Kunde",
    markAlt: "yfood",
  },
  en: {
    eyebrow: "Trusted by",
    caption: "Our first customer",
    markAlt: "yfood",
  },
} as const;
