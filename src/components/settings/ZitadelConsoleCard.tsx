/**
 * A settings card that points users to the Zitadel hosted console for account
 * or organization management — the replacement for Clerk's <UserProfile> /
 * <OrganizationProfile> surfaces. Pure presentational; rendered by the server
 * settings pages with translated strings + the console URL.
 */
export function ZitadelConsoleCard({
  title,
  description,
  linkLabel,
  href,
}: {
  title: string;
  description: string;
  linkLabel: string;
  href: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-card p-5">
      <h3 className="text-body-strong text-neutral-900">{title}</h3>
      <p className="mt-1 text-body text-neutral-500">{description}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex h-8 items-center justify-center rounded-md bg-primary-600 px-3 text-body-strong font-medium text-white transition-colors hover:bg-primary-hover"
      >
        {linkLabel} →
      </a>
    </div>
  );
}
