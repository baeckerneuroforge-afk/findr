import { auth, currentUser } from "@clerk/nextjs/server";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

export default async function DashboardPage() {
  const { orgId, orgSlug } = await auth();
  const user = await currentUser();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-obsidian-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <span className="text-xl font-semibold tracking-tight">Findr</span>
            <OrganizationSwitcher
              hidePersonal={false}
              afterCreateOrganizationUrl="/dashboard"
              afterSelectOrganizationUrl="/dashboard"
            />
          </div>
          <UserButton />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome, {user?.firstName ?? "there"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {orgId
            ? `Active organization: ${orgSlug ?? orgId}`
            : "No active organization. Create one to get started."}
        </p>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-obsidian-900 p-6">
            <h2 className="text-sm font-medium text-muted-foreground">
              User ID
            </h2>
            <p className="mt-2 font-mono text-sm break-all">{user?.id}</p>
          </div>
          <div className="rounded-lg border border-border bg-obsidian-900 p-6">
            <h2 className="text-sm font-medium text-muted-foreground">
              Org ID
            </h2>
            <p className="mt-2 font-mono text-sm break-all">
              {orgId ?? "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-obsidian-900 p-6">
            <h2 className="text-sm font-medium text-muted-foreground">
              Email
            </h2>
            <p className="mt-2 text-sm break-all">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
