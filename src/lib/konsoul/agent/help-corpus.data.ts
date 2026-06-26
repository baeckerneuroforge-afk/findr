import type { HelpTopic } from "./help-corpus";

/**
 * OWNER: impl:corpus. Diese Datei ist die SEPARATE Inhalts-Datei des Help-
 * Korpus (getrennt von help-corpus.ts, damit Engine und Korpus konfliktfrei
 * parallel gebaut werden). impl:engine hat dieses Array als ehrlichen Start-
 * Korpus angelegt, damit Engine + Tests sofort kompilieren/laufen; impl:corpus
 * besitzt und erweitert/verfeinert die Inhalte.
 *
 * REGELN (Plan §6, nicht verhandelbar): neutrale, kuratierte How-to-Texte,
 * du-Form, sachlich-helfend. KEINE Teilnehmer-PII, KEINE erfundenen Zahlen.
 * Jeder Topic liegt in de + en vor. Der `key` (nicht der Text) reist als
 * `sources`-Eintrag in der guidance-Antwort.
 *
 * Pfade beziehen sich auf den echten Produkt-Flow (z.B. der Anlege-Wizard unter
 * `/dashboard/market-research/new`).
 */
export const HELP_CORPUS: HelpTopic[] = [
  {
    key: "study.create",
    title: "Studie anlegen",
    aliases: [
      "studie anlegen",
      "neue studie",
      "create study",
      "new study",
      "wizard",
    ],
    body: {
      de: "Eine neue Studie legst du über den geführten Wizard an: Marktforschung, dann 'Neue Studie' (Route /dashboard/market-research/new). Du beschreibst dein Ziel, lässt die Themen-Leitfäden von der KI vorschlagen und passt sie an, optional lädst du einen Stimulus (Bild/Video/Link) hoch. Am Ende wird die Studie als Entwurf gespeichert; starten und verteilen sind eigene Schritte.",
      en: "Create a new study through the guided wizard: Market Research, then 'New study' (route /dashboard/market-research/new). You describe your goal, let the AI propose topic guides and adjust them, and optionally upload a stimulus (image/video/link). At the end the study is saved as a draft; launching and distributing are separate steps.",
    },
  },
  {
    key: "synthesis.howto",
    title: "Synthese erstellen",
    aliases: ["synthese", "synthesis", "auswerten", "befunde", "synthesize"],
    body: {
      de: "Sobald Interviews abgeschlossen und ausgewertet sind, öffnest du die Studie und klickst auf 'Synthese erstellen'. Die KI fasst die Interviews zu Überblick, wiederkehrenden Themen und Spannungsfeldern zusammen; jedes Thema bleibt durch ein wörtliches Zitat aus den Interviews belegt — was sich nicht belegen lässt, fällt weg. Die Synthese ist die Grundlage für die Personas und für studienübergreifende Fragen.",
      en: "Once interviews are completed and analysed, open the study and click 'Create synthesis'. The AI condenses the interviews into an overview, recurring themes and tensions; every theme stays backed by a verbatim quote from the interviews — anything that can't be grounded is dropped. The synthesis is the basis for personas and for cross-study questions.",
    },
  },
  {
    key: "personas.howto",
    title: "Personas erzeugen",
    aliases: ["personas", "persona", "zielgruppen", "segmente", "segments"],
    body: {
      de: "Personas erzeugst du nach der Synthese über 'Personas erzeugen'. Sie clustern die ausgewerteten Interviews in 3 bis 5 Segmente; jedes Merkmal bleibt wörtlich aus den Interviews belegt, und ein Segment ohne genug Beleg fällt einfach weg. Personas brauchen mindestens 10 ausgewertete Interviews; zwischen 10 und 14 erscheinen sie mit einem Qualitäts-Hinweis. Die genaue Zahl deiner Studie zeigt dir die Studienseite an.",
      en: "Generate personas after the synthesis via 'Generate personas'. They cluster the analysed interviews into 3 to 5 segments; each trait stays backed verbatim by the interviews, and a segment without enough evidence is simply dropped. Personas need at least 10 analysed interviews; between 10 and 14 they appear with a quality note. Your study page shows the exact count for your study.",
    },
  },
  {
    key: "interview.depth",
    title: "Interview-Tiefe",
    aliases: ["tiefe", "depth", "laddering", "nachfragen", "interview depth"],
    body: {
      de: "Die Interview-Tiefe steuert, wie tief der Agent pro Thema nachbohrt (Flach/Mittel/Tief = mehr Nachfrage-Schichten pro Thema). Du stellst sie beim Anlegen oder Bearbeiten der Studie ein. Tiefer heißt längere Interviews und reichhaltigere Befunde; flacher heißt kürzere, breitere Gespräche.",
      en: "Interview depth controls how deeply the agent probes per topic (shallow/medium/deep = more follow-up layers per topic). You set it when creating or editing the study. Deeper means longer interviews and richer findings; shallower means shorter, broader conversations.",
    },
  },
  {
    key: "pool.invite",
    title: "Pool / Einladung",
    aliases: ["pool", "einladen", "invite", "teilnehmer", "participants"],
    body: {
      de: "Im Teilnehmer-Pool sammelst du deine Kontakte org-weit. Aus einer Studie heraus lädst du daraus Personen ein; pro Studie wird jede Person höchstens einmal eingeladen. Du kannst auch direkt per E-Mail oder über einen offenen Link einladen.",
      en: "The participant pool collects your contacts org-wide. From within a study you invite people from it; each person is invited at most once per study. You can also invite directly by email or via an open link.",
    },
  },
  {
    key: "launch.distribution",
    title: "Verteilung / Launch",
    aliases: [
      "verteilung",
      "launch",
      "starten",
      "distribution",
      "veröffentlichen",
    ],
    body: {
      de: "Nach 'Studie starten' kommt der Verteilungs-Schritt: Du lädst aus dem Pool ein, teilst einen offenen Link oder rekrutierst extern über Prolific. Wo Prolific-Credentials verbunden sind und ein offener Link vorliegt, siehst du vorab eine Kosten-Schätzung. Ausgelöst wird die externe Rekrutierung erst, wenn du es ausdrücklich bestätigst — Konsoul löst hier nichts selbst aus.",
      en: "After 'Launch study' comes the distribution step: you invite from the pool, share an open link, or recruit externally via Prolific. Where Prolific credentials are connected and an open link exists, you see a cost estimate up front. External recruitment only fires when you confirm it explicitly — Konsoul never triggers it for you.",
    },
  },
  {
    key: "interview.mode",
    title: "Interview-Modus (Text oder Sprache)",
    aliases: [
      "voice",
      "sprache",
      "text",
      "sprachinterview",
      "voice interview",
      "modus",
      "tts",
    ],
    body: {
      de: "Beim Anlegen wählst du im Interview-Schritt, ob die Teilnehmer per Text oder per Sprache interviewt werden. Text ist der empfohlene Standard; Sprache schaltest du frei, wenn sie verfügbar ist. Beide führen dasselbe geführte Interview — nur die Eingabeart unterscheidet sich.",
      en: "When creating a study, the interview step lets you choose whether participants are interviewed by text or by voice. Text is the recommended default; you enable voice when it is available. Both run the same guided interview — only the input mode differs.",
    },
  },
  {
    key: "study.dryrun",
    title: "Trockenlauf / Studie testen",
    aliases: [
      "trockenlauf",
      "test",
      "dry run",
      "probelauf",
      "synthetic",
      "synthetisch",
      "guide testen",
    ],
    body: {
      de: "Bevor echte Menschen starten, kannst du die Studie als Trockenlauf testen: Der Interview-Bot befragt ein paar synthetische KI-Personas, damit du siehst, ob der Leitfaden klar ist und das Gespräch sauber läuft. Wichtig: synthetische Teilnehmer sind KEINE echte Marktmeinung — der Trockenlauf prüft nur den Guide, nicht den Markt.",
      en: "Before real people start, you can test the study as a dry run: the interview bot questions a few synthetic AI personas so you can see whether the guide is clear and the conversation runs cleanly. Important: synthetic participants are NOT real market opinion — the dry run only checks the guide, not the market.",
    },
  },
  {
    key: "crossstudy.ask",
    title: "Studienübergreifend fragen",
    aliases: [
      "studienübergreifend",
      "cross study",
      "vergleichen",
      "über studien",
      "compare studies",
      "konsoul",
      "frag",
    ],
    body: {
      de: "Sobald mehrere Studien synthetisiert sind, kannst du studienübergreifend fragen — zum Beispiel, in wie vielen Studien ein Thema auftaucht oder wie sich Befunde unterscheiden. Belegte Antworten sind je Studie mit einem wörtlichen Zitat verankert; Zahlen kommen aus exaktem Zählen. Was nicht belegbar ist, wird als Interpretation markiert oder ehrlich abgelehnt — nie geraten.",
      en: "Once several studies are synthesized, you can ask across studies — for example in how many studies a theme appears or how findings differ. Grounded answers are anchored per study with a verbatim quote; numbers come from exact counting. Anything that can't be grounded is flagged as interpretation or honestly declined — never guessed.",
    },
  },
  {
    key: "synthesis.share",
    title: "Synthese teilen",
    aliases: [
      "teilen",
      "share",
      "share link",
      "link teilen",
      "freigeben",
      "ergebnisse teilen",
    ],
    body: {
      de: "Eine fertige Synthese kannst du über einen schreibgeschützten Share-Link teilen, ohne dass die Empfänger ein Konto brauchen. Wörtliche Zitate erscheinen im geteilten Link nur, wenn du das ausdrücklich freischaltest — standardmäßig bleiben sie aus, damit nichts Sensibles ungewollt nach außen geht.",
      en: "You can share a finished synthesis via a read-only share link, without recipients needing an account. Verbatim quotes appear in the shared link only if you explicitly opt in — by default they stay off so nothing sensitive leaves unintentionally.",
    },
  },
];
