"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";

/**
 * Header account menu — the NextAuth/Zitadel replacement for Clerk's
 * <UserButton>. A monogram avatar opens a small dropdown showing the signed-in
 * identity and a sign-out action (signOut() → "/"). Deliberately schlicht:
 * full account management lives in the Zitadel console (settings/profile).
 */
export function UserMenu({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const initial = (name?.trim()?.[0] ?? email?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-caption font-semibold text-primary-700 ring-1 ring-neutral-200 transition-colors hover:ring-neutral-300"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-40 w-56 overflow-hidden rounded-lg border border-neutral-200 bg-card shadow-lg"
        >
          <div className="border-b border-neutral-100 px-4 py-3">
            <div className="truncate text-body-strong text-neutral-900">
              {name ?? email ?? "—"}
            </div>
            {email && (
              <div className="truncate text-caption text-neutral-500">
                {email}
              </div>
            )}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="block w-full px-4 py-2.5 text-left text-body text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            {t("userMenu.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
