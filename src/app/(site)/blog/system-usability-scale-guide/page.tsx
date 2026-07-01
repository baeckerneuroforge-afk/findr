import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";
import { buildAlternates, ogDefaultsFor, jsonLdHtml, SITE_URL } from "@/lib/marketing/seo";

const PATH = "/blog/system-usability-scale-guide";

export const metadata: Metadata = {
  title: { absolute: "System Usability Scale (SUS): Der vollständige Guide — Klymeo" },
  description:
    "System Usability Scale (SUS) erklärt: 10 Fragen, Berechnung des Scores, Benchmarks und wie Klymeos KI-Agent Konsoul SUS-Studien automatisch durchführt und auswertet.",
  alternates: buildAlternates("de", PATH),
  openGraph: {
    ...ogDefaultsFor("de"),
    title: "System Usability Scale (SUS) — Guide",
    description:
      "Methodik, Score-Berechnung, Benchmarks und automatisierte SUS-Auswertung mit KI.",
    url: PATH,
  },
};

const QUESTIONS = [
  "Ich denke, ich würde das System gerne häufig nutzen.",
  "Ich fand das System unnötig komplex.",
  "Ich fand das System einfach zu nutzen.",
  "Ich denke, ich bräuchte die Unterstützung einer Fachperson, um das System nutzen zu können.",
  "Ich fand, dass die verschiedenen Funktionen gut integriert waren.",
  "Ich fand, dass es im System zu viele Inkonsistenzen gab.",
  "Ich kann mir vorstellen, dass die meisten Menschen schnell lernen, mit dem System umzugehen.",
  "Ich fand das System sehr umständlich zu benutzen.",
  "Ich fühlte mich sehr sicher im Umgang mit dem System.",
  "Ich musste viele Dinge lernen, bevor ich mit dem System arbeiten konnte.",
];

export default function SusGuide() {
  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "System Usability Scale (SUS): Der vollständige Guide",
            description:
              "Methodik, Berechnung, Benchmarks und KI-gestützte Auswertung des System Usability Scale (SUS).",
            author: { "@type": "Organization", name: "Klymeo" },
            publisher: { "@type": "Organization", name: "Klymeo" },
            mainEntityOfPage: `${SITE_URL}${PATH}`,
            inLanguage: "de-DE",
          }),
        }}
      />

      <PageHero
        eyebrow="Methoden-Guide"
        title="System Usability Scale —"
        italic="der komplette Guide"
        lead="Wie der SUS funktioniert, wie du den Score berechnest, was die Werte bedeuten — und wie Konsoul SUS-Studien in Stunden statt Wochen auswertet."
        image="/site/blog-sus.jpg"
        imageAlt="Person testet eine digitale Anwendung"
      />

      <article className="mx-auto max-w-3xl px-6 py-20 prose-klymeo">
        <nav className="mb-12 rounded-2xl border border-border bg-secondary/40 p-6 text-sm">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Inhalt
          </p>
          <ol className="grid gap-2 text-ink/80">
            <li><a href="#was-ist-sus" className="hover:underline">1. Was ist der System Usability Scale?</a></li>
            <li><a href="#fragebogen" className="hover:underline">2. Der SUS-Fragebogen (10 Items)</a></li>
            <li><a href="#berechnung" className="hover:underline">3. SUS-Score berechnen</a></li>
            <li><a href="#benchmarks" className="hover:underline">4. Benchmarks & Interpretation</a></li>
            <li><a href="#einsatz" className="hover:underline">5. Wann SUS einsetzen — und wann nicht</a></li>
            <li><a href="#konsoul" className="hover:underline">6. SUS mit Konsoul automatisieren</a></li>
          </ol>
        </nav>

        <section id="was-ist-sus">
          <h2>1. Was ist der System Usability Scale?</h2>
          <p>
            Der <strong>System Usability Scale (SUS)</strong> ist ein 1986 von John Brooke entwickelter
            Fragebogen mit zehn Aussagen, der die <em>wahrgenommene Gebrauchstauglichkeit</em> einer
            digitalen Anwendung misst. Trotz seiner Kürze gilt SUS als einer der robustesten und am
            häufigsten validierten Usability-Indikatoren — er liefert mit nur 10 Items einen einzigen,
            vergleichbaren Score von 0 bis 100.
          </p>
          <p>
            SUS ist methodenagnostisch: Er funktioniert für Webseiten, Mobile-Apps, Enterprise-Software,
            Hardware-Interfaces und sogar Voice-UIs. Das macht ihn zum Standardwerkzeug, wenn Teams
            Versionen, Wettbewerber oder Releases <strong>vergleichen</strong> wollen.
          </p>
        </section>

        <section id="fragebogen">
          <h2>2. Der SUS-Fragebogen</h2>
          <p>
            Teilnehmende bewerten zehn Aussagen auf einer 5-stufigen Likert-Skala von
            <em> 1 = stimme überhaupt nicht zu </em> bis <em> 5 = stimme voll zu</em>. Ungerade Items
            sind positiv formuliert, gerade Items negativ — das verhindert Zustimmungsverzerrungen.
          </p>
          <ol>
            {QUESTIONS.map((q, i) => (
              <li key={i}>
                <span className="font-mono text-xs text-muted-foreground">Q{i + 1} ({i % 2 === 0 ? "+" : "−"})</span>{" "}
                {q}
              </li>
            ))}
          </ol>
        </section>

        <section id="berechnung">
          <h2>3. SUS-Score berechnen</h2>
          <ol>
            <li>Für <strong>ungerade Items</strong> (positiv): Antwortwert minus 1.</li>
            <li>Für <strong>gerade Items</strong> (negativ): 5 minus Antwortwert.</li>
            <li>Die Summe aller 10 transformierten Werte mit <strong>2,5</strong> multiplizieren.</li>
          </ol>
          <p>
            Ergebnis: ein Score zwischen <strong>0 und 100</strong>. Wichtig: Der SUS-Score ist
            <em> kein Prozentwert</em> — 68 bedeutet nicht „68 % Usability“, sondern entspricht ungefähr
            dem Mittelwert aller je gemessenen Systeme.
          </p>
        </section>

        <section id="benchmarks">
          <h2>4. Benchmarks & Interpretation</h2>
          <p>
            Nach Sauro & Lewis (2016) lassen sich SUS-Scores in eine Schulnoten-Skala übersetzen:
          </p>
          <div className="not-prose my-6 overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">SUS-Score</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Bedeutung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["> 80,3", "A", "Hervorragend — Nutzer würden aktiv weiterempfehlen"],
                  ["68 – 80,3", "B / C", "Gut bis akzeptabel — über dem Durchschnitt"],
                  ["51 – 68", "D", "Unterdurchschnittlich — Handlungsbedarf"],
                  ["< 51", "F", "Mangelhaft — fundamentale Usability-Probleme"],
                ].map(([range, grade, meaning]) => (
                  <tr key={range}>
                    <td className="px-4 py-3 font-mono">{range}</td>
                    <td className="px-4 py-3 font-medium">{grade}</td>
                    <td className="px-4 py-3 text-muted-foreground">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Der branchenübergreifende Durchschnitt liegt bei rund <strong>68</strong>. Alles darunter
            ist ein klares Signal, dass Nutzer Reibung erleben.
          </p>
        </section>

        <section id="einsatz">
          <h2>5. Wann SUS einsetzen — und wann nicht</h2>
          <p><strong>Gut geeignet für:</strong></p>
          <ul>
            <li>Vergleich von Versionen (A/B-Releases, vorher/nachher).</li>
            <li>Wettbewerbs-Benchmarks gegen Konkurrenzprodukte.</li>
            <li>Schnelles Pulse-Tracking über Quartale hinweg.</li>
            <li>Studien mit kleinen Stichproben (ab ~12–15 Teilnehmenden brauchbar).</li>
          </ul>
          <p><strong>Nicht geeignet für:</strong></p>
          <ul>
            <li>Diagnose <em>warum</em> ein System unbrauchbar ist — dafür brauchst du qualitative Interviews.</li>
            <li>Messung einzelner Features (SUS misst das Gesamterlebnis).</li>
            <li>Erste Discovery-Phasen, in denen das Produkt noch nicht testbar ist.</li>
          </ul>
        </section>

        <section id="konsoul">
          <h2>6. SUS mit Konsoul automatisieren</h2>
          <p>
            Eine klassische SUS-Studie kostet ein UX-Team typischerweise <strong>2–3 Wochen</strong>:
            Rekrutierung, Versand, Reminders, Datenbereinigung, Score-Berechnung, Report. Mit Konsoul,
            dem KI-Agenten von Klymeo, läuft derselbe Zyklus in <strong>Stunden</strong> ab:
          </p>
          <ul>
            <li>
              <strong>Setup in Klartext.</strong> Du beschreibst Konsoul die Zielgruppe und die zu
              testende Anwendung — der Fragebogen wird mit validierter SUS-Logik instanziiert.
            </li>
            <li>
              <strong>Rekrutierung &amp; Feldphase.</strong> Konsoul wählt aus dem Klymeo-Panel
              passende Teilnehmende aus, versendet Einladungen und überwacht Quoten in Echtzeit.
            </li>
            <li>
              <strong>Score-Berechnung.</strong> Jede Antwort wird sofort gemäß SUS-Formel transformiert;
              der mittlere Score plus Konfidenzintervall liegt vor, sobald die Quote erreicht ist.
            </li>
            <li>
              <strong>Qualitative Tiefe.</strong> Optional fragt Konsoul nach jedem SUS-Item eine
              kurze Begründung ab und clustert die offenen Antworten thematisch — du bekommst nicht nur
              die Note, sondern auch die Ursache.
            </li>
            <li>
              <strong>Report &amp; Vergleich.</strong> Benchmarks gegen frühere Wellen oder
              Wettbewerbsstudien werden automatisch berechnet und in einem teilbaren Report
              zusammengefasst — jede Aussage am Transkript belegt.
            </li>
          </ul>
        </section>

        <div className="mt-12 rounded-2xl border border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
          <p className="mb-3 font-medium text-ink">Weiterlesen</p>
          <ul className="grid gap-2">
            <li>
              <Link href="/loesungen/user-research" className="text-ink hover:underline">
                User-Research mit Klymeo →
              </Link>
            </li>
            <li>
              <Link href="/methoden" className="text-ink hover:underline">
                Alle Methoden im Überblick →
              </Link>
            </li>
            <li>
              <Link href="/konsoul" className="text-ink hover:underline">
                So funktioniert Konsoul →
              </Link>
            </li>
          </ul>
        </div>
      </article>

      <CtaBlock
        title="Bereit für deinen ersten"
        italic="SUS in 24 Stunden?"
        body="Konsoul rekrutiert, befragt und wertet aus — du bekommst Score, Benchmark und qualitative Tiefe in einem Report."
      />
    </SiteShell>
  );
}
