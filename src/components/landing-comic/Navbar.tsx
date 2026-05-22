"use client";

import Link from "next/link";
import { useAuth, useOrganization } from "@clerk/nextjs";
import { DEMO_BOOKING_URL } from "./constants";

const navLinks = [
  { href: "#platform", label: "Platform" },
  { href: "#modules", label: "Modules" },
  { href: "/pricing", label: "Pricing" },
  { href: "#why", label: "Why Findr" },
];

const btnBase =
  "font-grotesk font-semibold ink-border rounded-[11px] px-4 py-2 text-[14px] inline-block transition-transform duration-150 hover:-translate-x-px hover:-translate-y-px";

export function Navbar() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoaded: isOrgLoaded, organization } = useOrganization();

  const dashboardHref = organization ? "/dashboard" : "/onboarding/create-org";
  const dashboardLabel = organization ? "Dashboard" : "Complete setup";
  const authResolving = !isLoaded || (isSignedIn && !isOrgLoaded);

  return (
    <nav className="sticky top-0 z-50 bg-paper border-b-[2.5px] border-ink">
      <div className="max-w-[1180px] mx-auto px-7 py-[14px] flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-[3px] font-display font-extrabold text-[26px] tracking-[-0.04em] text-ink"
        >
          findr
          <span className="w-[9px] h-[9px] rounded-full bg-comic-red border-2 border-ink mb-[14px]" />
        </Link>

        <div className="flex items-center gap-[26px] font-medium text-[15px]">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden md:block text-ink hover:text-comic-red transition-colors"
            >
              {link.label}
            </Link>
          ))}

          {authResolving ? (
            <span
              aria-hidden
              className="h-9 w-[110px] rounded-[11px] ink-border bg-white/60"
            />
          ) : isSignedIn ? (
            <Link href={dashboardHref} className={`${btnBase} bg-comic-purple text-white shadow-hard-sm`}>
              {dashboardLabel}
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden md:block text-ink hover:text-comic-red transition-colors"
              >
                Sign in
              </Link>
              <a
                href={DEMO_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btnBase} bg-comic-purple text-white shadow-hard-sm`}
              >
                Book a demo
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
