"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth, clerkClient } from "@clerk/nextjs/server";

import { isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/locale";

/**
 * Persist the user's UI-language choice. Etappe-2 strategy = "cookie first":
 *
 *   1. findr.locale cookie         — the per-device fast path the locale
 *      resolver (src/i18n/request.ts) actually reads today. Setting this is
 *      what flips the UI.
 *   2. Clerk publicMetadata.locale — the durable, per-user home of the
 *      preference. Written here but NOT yet read by the resolver; it's the
 *      seed for the later cross-device upgrade (resolver fallback on the
 *      Clerk session-token claim). Best-effort on purpose: a Clerk failure
 *      must not undo the cookie switch the user just made.
 *
 * This is a Server Action, so `locale` is untrusted client input — it is
 * re-validated with isLocale before anything is written. updateUserMetadata
 * hits Clerk's PATCH /users/{id}/metadata endpoint, which DEEP-MERGES, so
 * passing only { locale } preserves any other publicMetadata keys.
 */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });

  try {
    const { userId } = await auth();
    if (userId) {
      const client = await clerkClient();
      await client.users.updateUserMetadata(userId, {
        publicMetadata: { locale },
      });
    }
  } catch (err) {
    console.error(
      "[setLocale] could not persist locale to Clerk publicMetadata:",
      err instanceof Error ? err.message : err,
    );
  }

  revalidatePath("/", "layout");
}
