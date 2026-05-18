import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-semibold tracking-tight">Findr</span>
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <Link
                href="/sign-in"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-violet-700"
              >
                Get started
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-violet-700"
              >
                Dashboard
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            Findr
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            AI-powered SaaS. Built on Next.js, Clerk, Supabase, and Anthropic.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className="rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-violet-700"
              >
                Get started
              </Link>
              <Link
                href="/sign-in"
                className="rounded-md border border-border px-6 py-3 text-base font-medium hover:bg-obsidian-800"
              >
                Sign in
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-violet-700"
              >
                Open dashboard
              </Link>
            </Show>
          </div>
        </div>
      </main>
    </div>
  );
}
