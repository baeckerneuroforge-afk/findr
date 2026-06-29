import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TRUST-BOUNDARY-Wächter (Persona ≠ Capabilities).
 *
 * Der TEILNEHMER-seitige Interviewer-Pfad (Voice-Agent-Kern + Interview-UI) darf
 * NIE den ORG-seitigen Konsoul-Orchestrator importieren — also nichts aus einem
 * `konsoul/`-Verzeichnis (src/lib/konsoul/**: engine, tools, Action-Allowlist,
 * orgId-Closure, propose_action). „Konsoul" als Interviewer ist ausschließlich
 * eine PERSONA (Name + Ton), niemals dessen Fähigkeiten. Die Persona lebt bewusst
 * in src/lib/voice-agent/konsoul-interviewer-persona.ts und importiert selbst
 * nichts aus konsoul/.
 *
 * Dieser Test scheitert, sobald irgendeine Quelldatei im Interviewer-/Voice-/
 * Interview-UI-Baum aus einem `konsoul/`-Verzeichnis importiert — egal ob
 * `@/lib/konsoul/…` oder `../konsoul/…`. Der relative Import der Persona-Datei
 * (`./konsoul-interviewer-persona` bzw. `@/lib/voice-agent/konsoul-interviewer-
 * persona`) matcht bewusst NICHT: nach „konsoul" folgt ein „-", kein „/".
 *
 * Vorbild: src/i18n/marketing-ssg-guard.test.ts (fs-Scan + Kommentar-Strip).
 */
const ROOTS = [
  "src/lib/voice-agent",
  "src/components/interview",
  "src/app/api/interview",
  "src/app/api/voice",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

// Block- + Zeilenkommentare strippen, damit Prosa, die `src/lib/konsoul/**` nur
// ERWÄHNT (wie dieser Docblock), den Wächter nicht triggert — nur echter Code zählt.
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("interviewer path stays free of the org-side Konsoul engine", () => {
  const files = ROOTS.flatMap((r) => walk(r));

  it("collected the interviewer/voice source files", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("never imports from a konsoul/ directory (engine/tools/allowlist/orgId)", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      // `from "@/lib/konsoul/…"` oder `from "../konsoul/…"` — der org-Orchestrator.
      // `./konsoul-interviewer-persona` (kein „/" nach „konsoul") ist erlaubt.
      if (/from\s+["'][^"']*konsoul\//.test(code)) {
        offenders.push(`${file}: imports from a konsoul/ directory`);
      }
      // Side-Effect-Import ohne `from` (`import "@/lib/konsoul/x"`) + dynamisches
      // `import("…/konsoul/x")` ebenfalls abdecken — Defense-in-Depth.
      if (/import\s*\(?\s*["'][^"']*konsoul\//.test(code)) {
        offenders.push(`${file}: side-effect/dynamic import of a konsoul/ module`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
