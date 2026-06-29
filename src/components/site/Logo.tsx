import Link from "next/link";

/**
 * Klymeo wordmark + animated mark. The PNG is self-hosted at /site/klymeo-logo.png
 * (downloaded from the design source — nothing loads from Lovable at runtime).
 * No hooks → usable from both the client header and the server footer.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`group flex items-center gap-2 ${className}`}
      aria-label="Klymeo Startseite"
    >
      <span className="relative inline-flex h-9 w-9 items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(124,107,255,0.4),transparent_70%)] blur-md opacity-70 transition-opacity duration-500 group-hover:opacity-100 group-hover:scale-125"
        />
        <img
          src="/site/klymeo-logo.png"
          alt=""
          aria-hidden
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
