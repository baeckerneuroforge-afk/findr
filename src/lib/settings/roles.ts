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

export function validateDeleteConfirmation(
  providedName: string | null | undefined,
  organizationName: string,
): boolean {
  return providedName?.trim() === organizationName.trim();
}
