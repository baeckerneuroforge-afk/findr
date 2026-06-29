import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";
import { ogDefaults, jsonLdHtml, SITE_URL } from "@/lib/marketing/seo";

const PATH = "/blog/ki-marktforschung-einsatz";

export const metadata: Metadata = {
  title: { absolute: "Wie man KI für die Marktforschung einsetzt — Praxis-Guide (2026)" },
  description:
    "Schritt-für-Schritt-Guide: Wie du KI in der Marktforschung einsetzt — vom Briefing über dialogische Interviews bis zum belegten Report. Mit Best Practices, Fallstricken und Use Cases.",
  alternates: { canonical: PATH },
  openGraph: {
    ...ogDefaults,
    title: "Wie man KI für die Marktforschung einsetzt",
    description:
      "Vom Briefing zum belegten Report: Wie KI qualitative Tiefe und automatisierte Synthese in einem Workflow vereint.",
    url: PATH,
  },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "Welche Aufgaben in der Marktforschung kann KI heute wirklich übernehmen?",
    a: "Studienkonzeption (Leitfaden, Screener, Hypothesen), Rekrutierung aus verifizierten Panels, dialogische Interviewmoderation, Transkription, qualitatives Clustering, quantitative Auswertung und Reporting mit Quellverweis. Die Entscheidung über Forschungsziel, Stichprobenstrategie und Stakeholder-Kommunikation bleibt beim Menschen.",
  },
  {
    q: "Verliere ich qualitative Tiefe, wenn ich Interviews von KI moderieren lasse?",
    a: "Nicht, wenn die KI dialogisch arbeitet — also bei spannenden Antworten gezielt nachfragt, statt nur Fragen abzuhaken. In Studien sehen wir oft, dass KI-Interviews mehr Offenheit erzeugen als ein menschlicher Moderator, weil Befragte keine sozialen Erwünschtheits-Reflexe haben.",
  },
  {
    q: "Wie stelle ich sicher, dass KI-Insights belastbar sind?",
    a: "Drei Hebel: (1) Echte Befragte aus verifizierten Panels, keine simulierten Personas. (2) Jeder Befund im Report muss auf das Originalzitat verlinken. (3) Stichprobengröße und Auswahlkriterien explizit dokumentieren — wie in klassischer Forschung.",
  },
  {
    q: "Wo beginne ich am besten mit KI in der Marktforschung?",
    a: "Such dir eine wiederkehrende, gut standardisierbare Studie aus — UX-Test, Konzepttest oder NPS-Welle. Führe sie einmal klassisch und einmal mit KI-Plattform parallel durch. Vergleiche Time-to-Insight, Kosten und Erkenntnistiefe. So baust du intern Vertrauen auf, bevor du komplexere Studien migrierst.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Forschungsfrage scharf stellen",
    body: "Bevor du irgendein Tool öffnest: Welche Entscheidung hängt am Ergebnis? Wer ist Stakeholder? Welche Zielgruppe? Eine KI-Plattform beschleunigt alles — auch die falsche Frage.",
  },
  {
    n: "02",
    title: "Methode und Stichprobe wählen",
    body: "Qualitatives Tiefeninterview, Konzepttest mit Stimuli, quantitativer Tracker? Lass die KI den Leitfaden aus deinem Briefing erstellen und prüfe ihn, statt selbst bei Null anzufangen.",
  },
  {
    n: "03",
    title: "Rekrutieren aus verifizierten Panels",
    body: "Stichprobenkriterien definieren, Panel zuschalten. Eine gute KI-Plattform liefert in Stunden, was klassische Institute in Wochen schaffen — bei vergleichbarer Quotenkontrolle.",
  },
  {
    n: "04",
    title: "Dialogisch interviewen lassen",
    body: "Die KI moderiert das Interview, fragt bei spannenden Aussagen nach, hält den Leitfaden ein. Du beobachtest die ersten Sessions live und schärfst den Prompt, falls nötig.",
  },
  {
    n: "05",
    title: "Auswerten am Originalzitat",
    body: "Cluster-Analyse, Sentiment, Themen-Heatmap — automatisch generiert, aber jeder Befund verlinkt auf die Originalstelle im Transkript. So bleibt jede Aussage prüfbar.",
  },
  {
    n: "06",
    title: "Reporten und entscheiden",
    body: "Executive Summary, Detailbefunde, Empfehlungen — als Slide, Notion-Seite oder API. Stakeholder klicken direkt vom Insight in das Originalzitat. Vertrauen entsteht durch Belegbarkeit.",
  },
];

export default function Guide() {
  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "Wie man KI für die Marktforschung einsetzt",
            description:
              "Praxis-Guide für den Einsatz von KI in der Marktforschung — von der Studienkonzeption bis zum Reporting.",
            author: { "@type": "Organization", name: "Klymeo" },
            publisher: { "@type": "Organization", name: "Klymeo" },
            mainEntityOfPage: `${SITE_URL}${PATH}`,
            inLanguage: "de-DE",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />

      <PageHero
        eyebrow="Praxis-Guide"
        title="Wie man KI für die"
        italic="Marktforschung einsetzt"
        lead="Vom klassischen Setup zum KI-augmentierten Workflow: Wie du in sechs Schritten qualitative Tiefe und automatisierte Synthese kombinierst — ohne Belastbarkeit zu verlieren."
        image="/site/blog-ki-marktforschung.jpg"
        imageAlt="Forscherin mit Laptop und Insight-Wand"
      />

      <article className="mx-auto max-w-3xl px-6 py-20 prose-klymeo">
        <nav className="mb-12 rounded-2xl border border-border bg-secondary/40 p-6 text-sm">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Inhalt
          </p>
          <ol className="grid gap-2 text-ink/80">
            <li><a href="#warum" className="hover:underline">1. Warum KI in der Marktforschung?</a></li>
            <li><a href="#workflow" className="hover:underline">2. Der KI-augmentierte Workflow in 6 Schritten</a></li>
            <li><a href="#qualitativ" className="hover:underline">3. Qualitative Tiefe trotz Automatisierung</a></li>
            <li><a href="#fallstricke" className="hover:underline">4. Typische Fallstricke</a></li>
            <li><a href="#einstieg" className="hover:underline">5. Wie du intern startest</a></li>
            <li><a href="#faq" className="hover:underline">6. FAQ</a></li>
          </ol>
        </nav>

        <section id="warum">
          <h2>1. Warum KI in der Marktforschung?</h2>
          <p>
            Klassische Marktforschung ist gründlich, aber langsam und teuer. Briefing, Leitfaden, Rekrutierung,
            Feldphase, Transkription, Codierung, Report — schnell vergehen sechs bis zehn Wochen pro Studie.
            Produktteams, die wöchentlich entscheiden, können sich diesen Takt nicht leisten.
          </p>
          <p>
            KI verkürzt nicht nur die Zeit, sie verschiebt den Engpass: Statt Wochen für die Auswertung fließen
            qualitative Insights jetzt fast in Echtzeit zurück ins Team. Wichtig ist dabei, dass die KI keine
            Befragten ersetzt, sondern die Arbeit der Forscher:innen <strong>verstärkt</strong> — Konzeption,
            Moderation, Synthese und Reporting werden zu einem orchestrierten Workflow.
          </p>
        </section>

        <section id="workflow">
          <h2>2. Der KI-augmentierte Workflow in 6 Schritten</h2>
          <div className="not-prose my-6 grid gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-secondary/30 p-6">
                <div className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Schritt {s.n}
                </div>
                <h3 className="mb-2 text-lg font-medium text-ink">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="qualitativ">
          <h2>3. Qualitative Tiefe trotz Automatisierung</h2>
          <p>
            Die häufigste Sorge: Verliere ich Tiefe, wenn keine Forscherin mehr live im Interview sitzt?
            In der Praxis sehen wir oft das Gegenteil. Drei Gründe:
          </p>
          <ul>
            <li>
              <strong>Mehr Offenheit.</strong> Befragte sprechen mit der KI freier — soziale Erwünschtheit
              und Interviewer-Bias fallen weg. Sensible Themen kommen schneller auf den Tisch.
            </li>
            <li>
              <strong>Konsistente Tiefe.</strong> Die KI fragt bei jeder spannenden Aussage nach,
              auch in Interview Nummer 47, wenn ein Mensch längst müde wäre.
            </li>
            <li>
              <strong>Volltext-Auswertung.</strong> Statt einer Stichprobe von Zitaten wird jedes
              Transkript komplett ausgewertet — keine Insights verschwinden im Aktenordner.
            </li>
          </ul>
        </section>

        <section id="fallstricke">
          <h2>4. Typische Fallstricke</h2>
          <ul>
            <li>
              <strong>Synthetische Befragte statt echter Menschen.</strong> Tools, die nur LLM-Personas
              simulieren, liefern keine belastbare Evidenz. Gut für Hypothesen, schlecht für Entscheidungen.
            </li>
            <li>
              <strong>Reports ohne Quellverweis.</strong> Wenn der KI-Befund nicht zum Originalzitat
              verlinkt, kannst du ihn Stakeholdern nicht verteidigen.
            </li>
            <li>
              <strong>Prompt-Engineering statt Forschungs-Handwerk.</strong> Die KI ersetzt keine
              saubere Forschungsfrage. Wer ohne Hypothese startet, bekommt schicke aber nutzlose Reports.
            </li>
            <li>
              <strong>Datenschutz unterschätzen.</strong> AVV, EU-Hosting und das Verbot, deine Studien
              für KI-Training zu nutzen, sind keine Nice-to-haves — sie sind Pflicht in der EU.
            </li>
          </ul>
        </section>

        <section id="einstieg">
          <h2>5. Wie du intern startest</h2>
          <p>
            Wir empfehlen den <strong>Parallel-Pilot</strong>: Wähle eine wiederkehrende Studie, die du
            ohnehin durchführst — UX-Test, Konzepttest, NPS-Welle. Führe sie einmal klassisch und einmal
            mit KI-Plattform parallel durch. Vergleiche drei Dimensionen:
          </p>
          <ol>
            <li><strong>Time-to-Insight</strong> — von Briefing bis Stakeholder-Präsi.</li>
            <li><strong>Kosten</strong> — pro Insight, nicht nur pro Studie.</li>
            <li><strong>Erkenntnistiefe</strong> — gleich, schwächer, stärker?</li>
          </ol>
          <p>
            In den meisten Pilotprojekten gewinnt der KI-Workflow bei Time-to-Insight um Faktor 5–10,
            spart 60–80&nbsp;% der Kosten und liefert vergleichbare bis bessere Tiefe.
          </p>
        </section>

        <section id="faq">
          <h2>6. Häufige Fragen</h2>
          <div className="not-prose grid gap-4">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-border bg-secondary/30 p-5 open:bg-secondary/50"
              >
                <summary className="cursor-pointer list-none font-medium text-ink">
                  {f.q}
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-12 rounded-2xl border border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
          <p className="mb-3 font-medium text-ink">Weiterlesen</p>
          <ul className="grid gap-2">
            <li>
              <Link href="/blog/ai-market-research-tools-comparison" className="text-ink hover:underline">
                KI-Marktforschungs-Tools im Vergleich →
              </Link>
            </li>
            <li>
              <Link href="/methoden" className="text-ink hover:underline">
                Alle Methoden im Überblick →
              </Link>
            </li>
            <li>
              <Link href="/plattform" className="text-ink hover:underline">
                Was die Klymeo-Plattform kann →
              </Link>
            </li>
          </ul>
        </div>
      </article>

      <CtaBlock
        title="Bereit für deinen"
        italic="ersten KI-Piloten?"
        body="15 Minuten mit unserem Team — wir schauen uns eine deiner wiederkehrenden Studien an und skizzieren den KI-augmentierten Workflow konkret für dich."
      />
    </SiteShell>
  );
}
