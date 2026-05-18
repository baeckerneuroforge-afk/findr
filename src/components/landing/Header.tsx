import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-mist/10 bg-obsidian/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" aria-label="Findr home" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Findr" className="h-[30px] w-auto" />
          </Link>

          {/* Center nav (desktop) */}
          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="/product"
              className="text-sm text-mist transition-colors hover:text-white"
            >
              Product
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-mist transition-colors hover:text-white"
            >
              Pricing
            </Link>
            <Link
              href="/customers"
              className="text-sm text-mist transition-colors hover:text-white"
            >
              Customers
            </Link>
          </nav>

          {/* Right (auth, desktop) */}
          <div className="hidden items-center gap-3 md:flex">
            <Show when="signed-out">
              <Link
                href="/sign-in"
                className="text-sm text-mist transition-colors hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
              >
                Get started
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
              >
                Dashboard
              </Link>
              <UserButton />
            </Show>
          </div>

          {/* Mobile hamburger (skeleton, not wired up) */}
          <button
            type="button"
            aria-label="Open menu"
            className="inline-flex items-center justify-center rounded-md p-2 text-mist hover:text-white md:hidden"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
