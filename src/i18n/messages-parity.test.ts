import { describe, expect, it } from "vitest";

import de from "../../messages/de.json";
import en from "../../messages/en.json";

/**
 * E0 — de/en-Schlüsselparität als Sicherheitsnetz. Die Teilnehmer-Texte tragen
 * rechtlich relevante Inhalte (KI-Offenlegung nach Art. 50(1) KI-VO,
 * Datenschutzhinweise): Ein Key, der nur in einer Sprache existiert, hieße,
 * dass eine Sprachgruppe den Hinweis NICHT sieht (next-intl wirft bzw. rendert
 * den Key-Pfad). Vorher gab es keinen automatisierten Paritäts-Check — die
 * Gleichheit war Konvention.
 *
 * Bewusst NUR Struktur (Key-Pfade), keine Werte: Übersetzungen dürfen frei
 * formuliert sein, Platzhalter-Parität ({name} etc.) wäre ein eigener Check.
 */

function keyPaths(node: unknown, prefix = ""): string[] {
  if (
    node === null ||
    typeof node !== "object" ||
    Array.isArray(node)
  ) {
    return [prefix];
  }
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("messages parity (de ↔ en)", () => {
  it("carries the identical key set in both locales", () => {
    const deKeys = keyPaths(de).sort();
    const enKeys = keyPaths(en).sort();

    const missingInEn = deKeys.filter((k) => !enKeys.includes(k));
    const missingInDe = enKeys.filter((k) => !deKeys.includes(k));

    // Beide Richtungen einzeln ausweisen — die Fehlermeldung nennt den
    // konkreten Key-Pfad statt eines unleserlichen Array-Diffs.
    expect(missingInEn, "keys present in de.json but missing in en.json").toEqual([]);
    expect(missingInDe, "keys present in en.json but missing in de.json").toEqual([]);
  });
});
