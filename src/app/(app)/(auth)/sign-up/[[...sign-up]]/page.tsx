import Link from "next/link";
import { signIn } from "@/auth";
import { KlymeoMark } from "@/components/shared/KlymeoMark";

/**
 * Registrierung über Zitadel (NextAuth v5). Ersetzt Clerks <SignUp>-Widget. Es
 * gibt keinen eigenen App-Registrierungs-Screen mehr: der Klick startet denselben
 * OIDC-Flow wie die Anmeldung — Zitadels Hosted Login bietet dort "Konto
 * erstellen" an (die gehostete Registrierung). Nach Abschluss landet der Nutzer
 * im Onboarding (Org anlegen), wie zuvor signUpFallbackRedirectUrl.
 */
export default function SignUpPage() {
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
        <h1 className="text-center text-2xl font-medium text-white">
          Konto erstellen
        </h1>
        <p className="mt-2 text-center text-sm text-mist">
          Registrierung läuft sicher über Zitadel.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("zitadel", {
              redirectTo: "/onboarding/create-org",
            });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-violet-700"
          >
            Mit Zitadel registrieren
          </button>
        </form>
      </div>

      <p className="mt-8 text-sm text-mist">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="text-violet-400 transition-colors hover:text-violet-300"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
