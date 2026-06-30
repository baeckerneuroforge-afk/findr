/**
 * Wie der "ended"-Status-Poller der VoiceInterviewView auflöst, wenn der
 * Server-Statusflip (open→completed) nicht innerhalb des Poll-Fensters ankommt.
 *
 * KERN-EINSICHT (Bugfix): Ein BEABSICHTIGTES Ende ist KEIN Verbindungsverlust.
 * Beendet die teilnehmende Person selbst (Beenden-Knopf) ODER verlässt der Agent
 * regulär den Raum, läuft der Abschluss server-seitig weiter — der Hetzner-Agent
 * ruft `/api/voice/complete` und flippt den Status (empirisch zuverlässig, nur
 * gelegentlich erst NACH dem kurzen Client-Fenster). In diesem Fall gehört der
 * ruhige Dankesscreen hin, NICHT der „Verbindung unterbrochen"-Fehler.
 *
 * `intentionalClose` ist genau dann gesetzt, wenn der Abbruch gewollt war
 * (endInterview / ParticipantDisconnected). `sawDoneSignal` ist gesetzt, wenn der
 * Agent das `interview_done_signal` geschickt hat (natürliches Ende). Beim Retry
 * setzt `start()` beide Refs zurück → ein echter Folge-Abbruch wird wieder als
 * "lost" erkannt.
 *
 * "lost" bleibt damit EXKLUSIV dem unbeabsichtigten Abbruch mitten im Gespräch
 * (intentionalClose=false, kein done-signal) vorbehalten — dort ist „Erneut
 * versuchen / Schriftlich fortsetzen" die richtige, sinnvolle Einladung.
 *
 * PURE + deterministisch → isoliert unit-testbar, ohne die LiveKit-Komponente zu
 * laden.
 */
export function endedPollOutcome(args: {
  sawDoneSignal: boolean;
  intentionalClose: boolean;
}): "done" | "lost" {
  return args.sawDoneSignal || args.intentionalClose ? "done" : "lost";
}
