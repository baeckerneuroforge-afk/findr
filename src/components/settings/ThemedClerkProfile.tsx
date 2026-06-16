"use client";

import { OrganizationProfile, UserProfile } from "@clerk/nextjs";

import { useTheme } from "@/components/theme/ThemeShell";
import { klymeoDashboardClerkAppearance } from "@/lib/clerk/dashboard-appearance";

/**
 * Client-Brücke für die Clerk-Profilflächen: die Settings-Seiten sind Server
 * Components und kennen die Theme-Präferenz (localStorage) nicht — erst hier
 * im Client wird die Appearance aus dem aufgelösten Modus gewählt. Beim
 * Umschalten re-rendert Clerk mit dem neuen variables-Satz.
 */
export function ThemedUserProfile() {
  const { resolvedDark } = useTheme();
  return (
    <UserProfile
      routing="hash"
      appearance={klymeoDashboardClerkAppearance(resolvedDark)}
    />
  );
}

export function ThemedOrganizationProfile() {
  const { resolvedDark } = useTheme();
  return (
    <OrganizationProfile
      routing="hash"
      appearance={klymeoDashboardClerkAppearance(resolvedDark)}
    />
  );
}
