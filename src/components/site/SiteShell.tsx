import Link from "next/link";
import { type ReactNode } from "react";
import { Logo } from "./Logo";
import { SiteHeader } from "./SiteHeader";
import { DEMO_URL } from "./constants";

export { DEMO_URL, SUPPORT_EMAIL } from "./constants";

const MARK_COLORS = ["mark-amber", "mark-pink", "mark-mint", "mark-sky", "mark-lilac"] as const;
function pickMark(seed: string, offset = 0) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return MARK_COLORS[(h + offset) % MARK_COLORS.length];
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40 py-16">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Qualitative Marktforschung mit KI — orchestriert von Konsoul. EU-gehostet in Frankfurt.
          </p>
          <p className="mt-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Always-on · v1
          </p>
        </div>
        <FooterCol
          title="Plattform"
          items={[
            { label: "Konsoul", to: "/konsoul" },
            { label: "Module", to: "/plattform" },
            { label: "Methoden", to: "/methoden" },
            { label: "Preise", to: "/preise" },
          ]}
        />
        <FooterCol
          title="Lösungen"
          items={[
            { label: "User Research", to: "/loesungen/user-research" },
            { label: "Konzept-Test", to: "/loesungen/konzept-test" },
            { label: "Marken­wahrnehmung", to: "/loesungen/markenwahrnehmung" },
            { label: "Bedarf & Verhalten", to: "/loesungen/bedarf-verhalten" },
            { label: "Personas", to: "/personas" },
          ]}
        />
        <FooterCol
          title="Unternehmen"
          items={[
            { label: "Branchen", to: "/branchen" },
            { label: "Kontakt", to: "/kontakt" },
            { label: "Impressum", to: "/impressum" },
            { label: "Datenschutz", to: "/datenschutz" },
            { label: "AGB", to: "/agb" },
            { label: "Cookies", to: "/cookies" },
          ]}
        />
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col items-start justify-between gap-2 px-6 text-xs text-muted-foreground md:flex-row md:items-center">
        <p>© {new Date().getFullYear()} Klymeo · Ibbenbüren</p>
        <p>🇪🇺 EU-gehostet · DSGVO · Belegt am Transkript</p>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; to: string }[];
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-soul">{title}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.label}>
            <Link href={i.to} className="text-muted-foreground transition hover:text-ink">
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-clip">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  italic,
  lead,
  image,
  imageAlt,
}: {
  eyebrow: string;
  title: string;
  italic?: string;
  lead?: string;
  mood?: "smile" | "think" | "wow" | "wink" | "listen" | "scan";
  image?: string;
  imageAlt?: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 dotgrid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" aria-hidden />
      {/* animated soft gradient blobs */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-soul/25 blur-3xl blob-a" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-[26rem] w-[26rem] rounded-full bg-ink/10 blur-3xl blob-b" aria-hidden />
      <div
        className={`relative mx-auto grid max-w-7xl gap-12 px-6 py-20 md:py-28 ${
          image ? "md:grid-cols-[1.3fr_1fr] md:items-center" : ""
        }`}
      >
        <div className={image ? "" : "max-w-3xl"}>
          <p className="text-xs uppercase tracking-[0.22em] text-soul opacity-0 [animation:fade-in_.7s_ease-out_.05s_forwards]">{eyebrow}</p>
          <h1 className="mt-4 text-[clamp(2.2rem,5vw,4rem)] leading-[1.05] tracking-[-0.03em] opacity-0 [animation:fade-in_.8s_ease-out_.15s_forwards]">
            {title} {italic && <span className={`mark ${pickMark(italic)}`}>{italic}</span>}
          </h1>
          {lead && (
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground opacity-0 [animation:fade-in_.8s_ease-out_.3s_forwards]">{lead}</p>
          )}
        </div>
        {image && (
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-secondary md:aspect-[3/4] opacity-0 [animation:fade-in_.9s_ease-out_.35s_forwards]">
            <img
              src={image}
              alt={imageAlt ?? ""}
              loading="lazy"
              className="h-full w-full object-cover kenburns"
            />
          </div>
        )}
      </div>
    </section>
  );
}

export function CtaBlock({
  title,
  italic,
  body,
  primary = "Demo buchen",
  secondary = "Mit Sales sprechen",
}: {
  title: string;
  italic?: string;
  body?: string;
  primary?: string;
  secondary?: string;
}) {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-ink px-10 py-16 text-paper md:px-16 md:py-20">
          <div
            className="absolute inset-0 opacity-30"
            aria-hidden
            style={{
              backgroundImage:
                "radial-gradient(circle at 90% 10%, oklch(0.72 0.16 55 / 0.6), transparent 50%), radial-gradient(circle at 10% 90%, oklch(0.4 0.05 280 / 0.5), transparent 55%)",
            }}
          />
          <div className="relative">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-paper/60">
              Lass uns loslegen
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl leading-[1.05] md:text-5xl">
              {title} {italic && <span className={`mark ${pickMark(italic, 2)}`}>{italic}</span>}
            </h2>
            {body && <p className="mt-5 max-w-xl text-paper/70">{body}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-2 rounded-full bg-soul px-6 py-3.5 text-sm font-medium text-ink transition hover:scale-[1.02] hover:shadow-[0_12px_40px_-10px_oklch(0.72_0.16_55_/_0.6)]"
              >
                {primary} <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
              </a>
              <Link
                href="/kontakt"
                className="inline-flex items-center gap-2 rounded-full border border-paper/20 px-6 py-3.5 text-sm font-medium text-paper transition hover:bg-paper/10"
              >
                {secondary}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
