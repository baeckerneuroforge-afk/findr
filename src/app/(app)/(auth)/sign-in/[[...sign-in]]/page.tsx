import Link from "next/link";
import { signIn } from "@/auth";
import { KlymeoMark } from "@/components/shared/KlymeoMark";

/**
 * Anmeldung über Zitadel (NextAuth v5). Ersetzt Clerks <SignIn>-Widget: ein
 * Klick startet den OIDC-Flow (signIn → Zitadel Hosted Login → Callback). Die
 * Klymeo-Markenoptik der Seite bleibt erhalten.
 *
 * Next 16: searchParams ist asynchron. `callbackUrl` (vom Proxy gesetzt, wenn
 * ein geschützter Pfad ohne Session aufgerufen wurde) führt nach erfolgreicher
 * Anmeldung zurück zum ursprünglichen Ziel; Standard ist /dashboard.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        aria-label="Klymeo home"
        className="mb-8 inline-flex items-center gap-2"
      >
        <KlymeoMark tone="onDark" className="h-8 w-8" />
        <span
          className="text-2xl text-white"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            letterSpacing: "-0.04em",
          }}
        >
          Klymeo
        </span>
      </Link>

      <div className="w-full max-w-sm rounded-lg border border-mist/15 bg-obsidian-light p-8 shadow-2xl">
        <h1 className="text-center text-2xl font-medium text-white">Anmelden</h1>
        <p className="mt-2 text-center text-sm text-mist">
          Weiter mit deinem Klymeo-Konto.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("zitadel", {
              redirectTo: callbackUrl || "/dashboard",
            });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-violet-700"
          >
            Mit Zitadel anmelden
          </button>
        </form>
      </div>

      <p className="mt-8 text-sm text-mist">
        Don&rsquo;t have an account?{" "}
        <Link
          href="/sign-up"
          className="text-violet-400 transition-colors hover:text-violet-300"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
