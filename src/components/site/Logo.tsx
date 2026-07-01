import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/i18n/marketing-locale";

/**
 * Klymeo wordmark + animated mark. The PNG is self-hosted at
 * /site/klymeo-logo-144.png — a 144×144 sips-derivative of the original
 * 904×904 /site/klymeo-logo.png (kept for other consumers), since the mark
 * renders at 36px (4× = comfortable Retina headroom).
 * No hooks → usable from both the client header and the server footer.
 *
 * `lang` points the home link at the locale's homepage (`/en` vs `/`) so
 * clicking the logo keeps an English visitor in English. Defaults to German.
 */
export function Logo({
  className = "",
  lang = "de",
}: {
  className?: string;
  lang?: Locale;
}) {
  return (
    <Link
      href={lang === "en" ? "/en" : "/"}
      className={`group flex items-center gap-2 ${className}`}
      aria-label={lang === "en" ? "Klymeo home" : "Klymeo Startseite"}
    >
      <span className="relative inline-flex h-9 w-9 items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(124,107,255,0.4),transparent_70%)] blur-md opacity-70 transition-opacity duration-500 group-hover:opacity-100 group-hover:scale-125"
        />
        <Image
          src="/site/klymeo-logo-144.png"
          alt=""
          aria-hidden
          width={36}
          height={36}
          draggable={false}
          className="relative h-9 w-9 select-none transition-transform duration-700 ease-out group-hover:rotate-[28deg] group-hover:scale-110 animate-[logo-float_7s_ease-in-out_infinite]"
        />
      </span>
      <span
        className="font-display text-[1.4rem] tracking-[-0.02em] transition-transform duration-300 group-hover:-translate-y-[1px]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Klymeo
      </span>
    </Link>
  );
}
