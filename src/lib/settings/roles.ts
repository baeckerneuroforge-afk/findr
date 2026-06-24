export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase();
  return (
    normalized === "admin" ||
    normalized === "owner" ||
    normalized === "org:admin" ||
    normalized.endsWith(":admin") ||
    normalized.endsWith(":owner")
  );
}

/**
 * Admin gate for the Zitadel role model: a user is an org admin if ANY of their
 * granted role names qualifies via isAdminRole(). Used by the settings gates
 * (server: session.user.roles; client: useSession().user.roles).
 */
export function hasAdminRole(roles: string[] | null | undefined): boolean {
  return (roles ?? []).some(isAdminRole);
}

export function validateDeleteConfirmation(
  providedName: string | null | undefined,
  organizationName: string,
): boolean {
  return providedName?.trim() === organizationName.trim();
}
