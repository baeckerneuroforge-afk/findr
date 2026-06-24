"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/locale";

/**
 * Persist the user's UI-language choice. Strategy = "cookie first":
 *
 *   klymeo.locale cookie — the per-device fast path the locale resolver
 *   (src/i18n/request.ts) actually reads. Setting it is what flips the UI.
 *
 * The former Clerk publicMetadata.locale write — a dormant seed for cross-device
 * sync that nothing ever read — was removed with the Zitadel migration. Durable
 * per-user storage can later use the additive `users.locale` column once users
 * are provisioned per Zitadel sub; until then the cookie is the source of truth.
 *
 * This is a Server Action, so `locale` is untrusted client input — it is
 * re-validated with isLocale before anything is written.
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

  revalidatePath("/", "layout");
}
