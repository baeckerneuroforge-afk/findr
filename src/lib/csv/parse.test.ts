import { describe, expect, it } from "vitest";
import { z } from "zod";

import { PoolMemberSchema } from "../schemas/participant-pool";
import {
  decodeCsvBuffer,
  MAX_POOL_EMAIL_LENGTH,
  parseBulkInput,
  parseCsvInput,
  parsePoolCsv,
  POOL_CSV_TEMPLATES,
  STRICT_EMAIL_RE,
} from "./parse";

/**
 * Golden-Tests für die aus BulkInviteForm extrahierten Parser: Abschnitt 1+2
 * pinnen das BESTEHENDE Verhalten (Extraktion darf nichts ändern), Abschnitt 3
 * spezifiziert den neuen Pool-Parser. Die weiteren Abschnitte pinnen die
 * Review-Fixes: Server-Paritäts-Regex (zod), Encoding-Fallback, Delimiter-/
 * Header-Erkennung bei führenden Leerzeilen, Positions-Fallback im
 * Header-Modus, Vorlagen-Roundtrip und Parser↔Schema-Parität.
 */

// ── parseBulkInput (Textarea-Pfad, verbatim übernommen) ──────────────────────

describe("parseBulkInput", () => {
  it("parses 'label, email' lines and keeps commas inside the label", () => {
    const { parsed, issues } = parseBulkInput(
      "Jane Doe, Acme, jane@acme.io\nBob, bob@x.de",
    );
    expect(issues).toEqual([]);
    expect(parsed).toEqual([
      {
        raw: "Jane Doe, Acme, jane@acme.io",
        lineNumber: 1,
        contactLabel: "Jane Doe, Acme",
        contactEmail: "jane@acme.io",
      },
      {
        raw: "Bob, bob@x.de",
        lineNumber: 2,
        contactLabel: "Bob",
        contactEmail: "bob@x.de",
      },
    ]);
  });

  it("treats a lone email as label+email and a lone name as label-only", () => {
    const { parsed } = parseBulkInput("jane@acme.io\nJane Doe");
    expect(parsed[0]).toMatchObject({
      contactLabel: "jane@acme.io",
      contactEmail: "jane@acme.io",
    });
    expect(parsed[1]).toMatchObject({
      contactLabel: "Jane Doe",
      contactEmail: null,
    });
  });

  it("keeps the whole line as label when no segment is an email", () => {
    const { parsed } = parseBulkInput("Jane, Acme, Berlin");
    expect(parsed[0]).toMatchObject({
      contactLabel: "Jane, Acme, Berlin",
      contactEmail: null,
    });
  });

  it("skips blank and comment lines without issues", () => {
    const { parsed, issues } = parseBulkInput("\n# Kommentar\n\nJane, j@x.de\n");
    expect(issues).toEqual([]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].lineNumber).toBe(4);
  });

  it("reports over-long labels with the original line number", () => {
    const longName = "x".repeat(201);
    const { parsed, issues } = parseBulkInput(`ok, ok@x.de\n${longName}, a@b.de`);
    expect(parsed).toHaveLength(1);
    expect(issues).toEqual([
      {
        raw: `${longName}, a@b.de`,
        lineNumber: 2,
        messageKey: "issueNameTooLong",
      },
    ]);
  });

  it("flags detected-but-server-invalid emails per row instead of folding them into the label", () => {
    // Erkennung lax (das Segment IST ein E-Mail-Versuch), Validierung strikt
    // (zod-Parität): Umlaut-Adressen werden gemeldet — vorher passierten sie
    // die Vorschau und rissen serverseitig den ganzen Batch.
    const { parsed, issues } = parseBulkInput(
      "Jörg, jörg@müller.de\nOk, ok@x.de",
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].contactLabel).toBe("Ok");
    expect(issues.map((i) => i.messageKey)).toEqual(["issueInvalidEmail"]);
  });

  it("flags emails over the server's 320-char cap", () => {
    const longEmail = "a".repeat(310) + "@" + "b".repeat(8) + ".de";
    const { parsed, issues } = parseBulkInput(`Jane, ${longEmail}`);
    expect(parsed).toEqual([]);
    expect(issues.map((i) => i.messageKey)).toEqual(["issueEmailTooLong"]);
  });
});

// ── parseCsvInput (CSV-Pfad der Plan-Invites, verbatim übernommen) ────────────

describe("parseCsvInput", () => {
  it("detects a comma header row and starts data at line 2", () => {
    const { parsed, issues } = parseCsvInput(
      "Name,Email\nJane Doe,jane@acme.io\nBob,bob@x.de\n",
    );
    expect(issues).toEqual([]);
    expect(parsed).toEqual([
      {
        raw: "Jane Doe,jane@acme.io",
        lineNumber: 2,
        contactLabel: "Jane Doe",
        contactEmail: "jane@acme.io",
      },
      {
        raw: "Bob,bob@x.de",
        lineNumber: 3,
        contactLabel: "Bob",
        contactEmail: "bob@x.de",
      },
    ]);
  });

  it("auto-detects the semicolon delimiter of DE Excel exports", () => {
    const { parsed } = parseCsvInput("Name;E-Mail\nJane;jane@acme.io\n");
    expect(parsed).toEqual([
      {
        raw: "Jane;jane@acme.io",
        lineNumber: 2,
        contactLabel: "Jane",
        contactEmail: "jane@acme.io",
      },
    ]);
  });

  it("strips a UTF-8 BOM before header detection", () => {
    const { parsed } = parseCsvInput("﻿Name,Email\nJane,j@x.de\n");
    expect(parsed).toHaveLength(1);
    expect(parsed[0].contactLabel).toBe("Jane");
  });

  it("preserves quoted fields with embedded commas and escaped quotes", () => {
    const { parsed } = parseCsvInput(
      '"Doe, Jane",jane@x.de\n"Say ""hi""",hi@x.de\n',
    );
    expect(parsed[0]).toMatchObject({
      contactLabel: "Doe, Jane",
      contactEmail: "jane@x.de",
    });
    expect(parsed[1]).toMatchObject({
      contactLabel: 'Say "hi"',
      contactEmail: "hi@x.de",
    });
  });

  it("uses positional columns (0=name, 1=email) when no header is present", () => {
    const { parsed } = parseCsvInput("Jane,jane@x.de");
    expect(parsed[0]).toMatchObject({
      lineNumber: 1,
      contactLabel: "Jane",
      contactEmail: "jane@x.de",
    });
  });

  it("falls back to email-as-label for an email-only header file", () => {
    const { parsed } = parseCsvInput("Email\njane@x.de\n");
    expect(parsed[0]).toMatchObject({
      contactLabel: "jane@x.de",
      contactEmail: "jane@x.de",
    });
  });

  it("treats single-column no-header rows as label-only (col 0 = name wins; unlike parseBulkInput, the email is NOT auto-detected)", () => {
    // Pinned ACTUAL behavior of the original parser: without a header,
    // nameColIdx=0 captures the lone cell as the label before the
    // degenerate email branch can fire. parseBulkInput differs here.
    const { parsed } = parseCsvInput("jane@x.de\nJane Doe");
    expect(parsed[0]).toMatchObject({
      contactLabel: "jane@x.de",
      contactEmail: null,
    });
    expect(parsed[1]).toMatchObject({
      contactLabel: "Jane Doe",
      contactEmail: null,
    });
  });

  it("skips blank and comment rows and handles CRLF + missing trailing newline", () => {
    const { parsed, issues } = parseCsvInput(
      "Name,Email\r\n#kommentar,x\r\n,\r\nJane,j@x.de",
    );
    expect(issues).toEqual([]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].lineNumber).toBe(4);
  });

  it("reports invalid emails per row instead of failing the file", () => {
    const { parsed, issues } = parseCsvInput(
      "Name,Email\nJane,not-an-email\nBob,bob@x.de\n",
    );
    expect(parsed).toHaveLength(1);
    expect(issues).toEqual([
      {
        raw: "Jane,not-an-email",
        lineNumber: 2,
        messageKey: "issueInvalidEmail",
      },
    ]);
  });

  it("rejects emails the server would reject (umlauts, strict parity) per row", () => {
    const { parsed, issues } = parseCsvInput(
      "Name,Email\nJörg,jörg@müller.de\nOk,ok@x.de\n",
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].contactLabel).toBe("Ok");
    expect(issues.map((i) => i.messageKey)).toEqual(["issueInvalidEmail"]);
  });

  it("returns empty results for an empty input", () => {
    const { parsed, issues } = parseCsvInput("");
    expect(parsed).toEqual([]);
    expect(issues).toEqual([]);
  });
});

// ── parsePoolCsv (neu: Pool-Spalten via Header-Mapping) ───────────────────────

describe("parsePoolCsv", () => {
  it("maps the German semicolon template incl. quoted multi-tag cells", () => {
    const { parsed, issues } = parsePoolCsv(
      'Name;E-Mail;Rolle;Segment;Tags;Notizen\nJane Doe;jane@acme.io;Head of Sales;Enterprise;"B2B, Founder";Aus Webinar\n',
    );
    expect(issues).toEqual([]);
    expect(parsed).toEqual([
      {
        raw: "Jane Doe;jane@acme.io;Head of Sales;Enterprise;B2B, Founder;Aus Webinar",
        lineNumber: 2,
        contactLabel: "Jane Doe",
        contactEmail: "jane@acme.io",
        role: "Head of Sales",
        segment: "Enterprise",
        tags: ["B2B", "Founder"],
        notes: "Aus Webinar",
      },
    ]);
  });

  it("maps the English comma template", () => {
    const { parsed } = parsePoolCsv(
      "Name,Email,Role,Segment,Tags,Notes\nBob,bob@x.de,PM,SMB,beta,from event\n",
    );
    expect(parsed[0]).toMatchObject({
      contactLabel: "Bob",
      contactEmail: "bob@x.de",
      role: "PM",
      segment: "SMB",
      tags: ["beta"],
      notes: "from event",
    });
  });

  it("recognizes headers case-insensitively, in any column order, ignoring unknown columns", () => {
    const { parsed } = parsePoolCsv(
      "Firma,ROLLE,name,E-MAIL\nAcme,Sales Lead,Jane,jane@x.de\n",
    );
    expect(parsed[0]).toMatchObject({
      contactLabel: "Jane",
      contactEmail: "jane@x.de",
      role: "Sales Lead",
      segment: null,
      tags: [],
      notes: null,
    });
  });

  it("keeps positional name/email and empty extended fields when no header exists", () => {
    const { parsed } = parsePoolCsv("Jane,jane@x.de,irgendwas\n");
    expect(parsed[0]).toMatchObject({
      contactLabel: "Jane",
      contactEmail: "jane@x.de",
      role: null,
      segment: null,
      tags: [],
      notes: null,
    });
  });

  it("returns zero rows and zero issues for a header-only file", () => {
    const { parsed, issues } = parsePoolCsv("Name;E-Mail;Rolle\n");
    expect(parsed).toEqual([]);
    expect(issues).toEqual([]);
  });

  it("dedupes and trims tags with the same rule as manual entry", () => {
    const { parsed } = parsePoolCsv(
      'Name,Tags\nJane,"B2B; B2B , Founder,,Power-User"\n',
    );
    expect(parsed[0].tags).toEqual(["B2B", "Founder", "Power-User"]);
  });

  it("falls back to email-as-label when the name cell is empty", () => {
    const { parsed } = parsePoolCsv("Name,Email\n,jane@x.de\n");
    expect(parsed[0]).toMatchObject({
      contactLabel: "jane@x.de",
      contactEmail: "jane@x.de",
    });
  });

  it("skips rows that violate pool field limits and reports the reason", () => {
    const longRole = "r".repeat(81);
    const longTag = "t".repeat(41);
    const manyTags = Array.from({ length: 31 }, (_, i) => `tag${i}`).join(", ");
    const longNotes = "n".repeat(2001);
    const { parsed, issues } = parsePoolCsv(
      [
        "Name,Email,Role,Segment,Tags,Notes",
        `Role Too Long,a@x.de,${longRole},,,`,
        `Seg Too Long,b@x.de,,${"s".repeat(81)},,`,
        `Tag Too Long,c@x.de,,,"${longTag}",`,
        `Too Many Tags,d@x.de,,,"${manyTags}",`,
        `Notes Too Long,e@x.de,,,,${longNotes}`,
        "Fine,f@x.de,PM,SMB,beta,ok",
      ].join("\n"),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].contactLabel).toBe("Fine");
    expect(issues.map((i) => i.messageKey)).toEqual([
      "issueRoleTooLong",
      "issueSegmentTooLong",
      "issueTagsInvalid",
      "issueTagsInvalid",
      "issueNotesTooLong",
    ]);
    expect(issues.map((i) => i.lineNumber)).toEqual([2, 3, 4, 5, 6]);
  });

  it("reports name/email issues with the shared invite keys", () => {
    const { parsed, issues } = parsePoolCsv(
      "Name,Email\nJane,kaputt\n,\nOk,ok@x.de\n",
    );
    expect(parsed).toHaveLength(1);
    expect(issues.map((i) => i.messageKey)).toEqual(["issueInvalidEmail"]);
  });

  it("rejects emails in the preview exactly like the server schema (umlauts etc.)", () => {
    // DER Praxisfall im DE-Markt: Umlaut-Adressen bestehen das lockere
    // Invite-Regex, aber nicht zods .email() — ohne Client-Parität würde
    // die Vorschau grün zeigen und der Server die Zeile abweisen.
    const { parsed, issues } = parsePoolCsv(
      "Name,Email\nJörg,jörg@müller.de\nOk,ok@x.de\n",
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].contactLabel).toBe("Ok");
    expect(issues.map((i) => i.messageKey)).toEqual(["issueInvalidEmail"]);
  });

  it("skips rows whose email exceeds the server's length cap", () => {
    const longEmail = "a".repeat(310) + "@" + "b".repeat(8) + ".de";
    expect(longEmail.length).toBeGreaterThan(MAX_POOL_EMAIL_LENGTH);
    expect(STRICT_EMAIL_RE.test(longEmail)).toBe(true);
    const { parsed, issues } = parsePoolCsv(`Name,Email\nJane,${longEmail}\n`);
    expect(parsed).toEqual([]);
    expect(issues.map((i) => i.messageKey)).toEqual(["issueEmailTooLong"]);
  });

  it("rescues positional name/email when the header only matches pool columns", () => {
    // Kopfzeile mit unbekannten Name-/E-Mail-Synonymen, aber erkannter
    // Pool-Spalte: ohne Positions-Fallback fiele JEDE Datenzeile mit
    // issueNoName durch, obwohl Spalte 0/1 sauber Name/E-Mail enthalten.
    const { parsed, issues } = parsePoolCsv(
      "Teilnehmername;Mailadresse;Notizen\nAnna;anna@x.de;VIP\nBernd;bernd@x.de;\n",
    );
    expect(issues).toEqual([]);
    expect(parsed[0]).toMatchObject({
      contactLabel: "Anna",
      contactEmail: "anna@x.de",
      notes: "VIP",
    });
    expect(parsed[1]).toMatchObject({
      contactLabel: "Bernd",
      contactEmail: "bernd@x.de",
      notes: null,
    });
  });

  it("does not positionally override a column claimed by a recognized keyword", () => {
    // 'Notizen' beansprucht Spalte 0 → Name bleibt unbesetzt; die
    // E-Mail-als-Label-Rettung greift pro Zeile.
    const { parsed } = parsePoolCsv("Notizen;E-Mail\nVIP;jane@x.de\n");
    expect(parsed[0]).toMatchObject({
      contactLabel: "jane@x.de",
      contactEmail: "jane@x.de",
      notes: "VIP",
    });
  });

  it("keeps later rows importable when a data cell accidentally matches a header keyword", () => {
    // Vorbestehende Klasse (auch im Invite-Parser): exakter Keyword-Match in
    // der ersten Zeile ("Position") schluckt sie als Header. Der Positions-
    // Fallback hält den Rest der Datei nutzbar statt alles abzuweisen.
    const { parsed } = parsePoolCsv("Position,max@firma.de\nCEO,eva@x.de\n");
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      contactLabel: "eva@x.de",
      contactEmail: "eva@x.de",
      role: "CEO",
    });
  });
});

// ── Delimiter-/Header-Erkennung bei führenden Leerzeilen ─────────────────────

describe("Erkennung bei führenden Leerzeilen", () => {
  it("detects the semicolon delimiter and the header past a leading blank line (pool)", () => {
    const { parsed, issues } = parsePoolCsv("\nName;E-Mail\nJane;jane@x.de\n");
    expect(issues).toEqual([]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      contactLabel: "Jane",
      contactEmail: "jane@x.de",
      lineNumber: 3,
    });
  });

  it("detects the semicolon delimiter and the header past a leading CRLF blank line (invites)", () => {
    const { parsed, issues } = parseCsvInput("\r\nName;E-Mail\r\nJane;jane@x.de\r\n");
    expect(issues).toEqual([]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      contactLabel: "Jane",
      contactEmail: "jane@x.de",
    });
  });

  it("ignores whitespace-only first lines for detection", () => {
    const { parsed } = parsePoolCsv("  \nName;E-Mail\nJane;jane@x.de\n");
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      contactLabel: "Jane",
      contactEmail: "jane@x.de",
    });
  });
});

// ── Server-Paritäts-Regex ─────────────────────────────────────────────────────

describe("STRICT_EMAIL_RE", () => {
  it("is byte-identical to zod's default email regex (the server schema's source)", () => {
    expect(STRICT_EMAIL_RE.source).toBe(z.regexes.email.source);
  });

  it("rejects what the server rejects and the loose invite regex let through", () => {
    for (const bad of [
      "jörg@müller.de",
      "müller@firma.de",
      "a@b.c",
      "jane@acme.io.",
      "user@my_domain.com",
      "jane..doe@x.de",
    ]) {
      expect(STRICT_EMAIL_RE.test(bad), bad).toBe(false);
    }
    for (const ok of ["jane@x.de", "jane+tag@acme-corp.io", "j.doe@sub.acme.de"]) {
      expect(STRICT_EMAIL_RE.test(ok), ok).toBe(true);
    }
  });
});

// ── Encoding-Fallback ─────────────────────────────────────────────────────────

describe("decodeCsvBuffer", () => {
  /** Mini-Encoder für den Testkorpus: im Latin-1-Bereich ist der Windows-
   *  1252-Bytewert identisch mit dem Codepoint (ü = 0xFC). */
  const cp1252Bytes = (s: string): ArrayBuffer =>
    new Uint8Array([...s].map((ch) => ch.charCodeAt(0))).buffer;

  it("decodes UTF-8 input as UTF-8 (umlauts intact, BOM stripped by the decoder)", () => {
    const utf8 = new TextEncoder().encode("﻿Name;Jürgen");
    expect(decodeCsvBuffer(utf8.buffer)).toBe("Name;Jürgen");
  });

  it("falls back to Windows-1252 for ANSI DE-Excel exports", () => {
    expect(decodeCsvBuffer(cp1252Bytes("Jürgen;jürgen@x.de"))).toBe(
      "Jürgen;jürgen@x.de",
    );
  });

  it("re-decodes pre-corrupted UTF-8 as 1252 (documented trade-off — file was already damaged)", () => {
    // U+FFFD ist in UTF-8 EF BF BD → als Windows-1252 gelesen "ï¿½".
    const withReplacement = new TextEncoder().encode("kaputt � hier");
    expect(decodeCsvBuffer(withReplacement.buffer)).toContain("ï¿½");
  });
});

// ── Vorlagen-Roundtrip ────────────────────────────────────────────────────────
// Pinnt mechanisch, dass die offiziellen Download-Vorlagen vollständig durch
// den Parser kommen — eine umbenannte Header-Spalte ohne nachgezogene
// HEADER_*_KEYS fällt hier auf, statt dass Vorlagen-Nutzer still Spalten
// verlieren.

describe("POOL_CSV_TEMPLATES", () => {
  it("round-trips the German semicolon template with every column mapped", () => {
    const { parsed, issues } = parsePoolCsv(POOL_CSV_TEMPLATES.de.content);
    expect(issues).toEqual([]);
    expect(parsed).toEqual([
      {
        raw: "Jane Doe;jane@acme.example;Head of Sales;Enterprise;Bestandskunde, Power-User;Aus Webinar Q3",
        lineNumber: 2,
        contactLabel: "Jane Doe",
        contactEmail: "jane@acme.example",
        role: "Head of Sales",
        segment: "Enterprise",
        tags: ["Bestandskunde", "Power-User"],
        notes: "Aus Webinar Q3",
      },
    ]);
  });

  it("round-trips the English comma template with every column mapped", () => {
    const { parsed, issues } = parsePoolCsv(POOL_CSV_TEMPLATES.en.content);
    expect(issues).toEqual([]);
    expect(parsed[0]).toMatchObject({
      contactLabel: "Jane Doe",
      contactEmail: "jane@acme.example",
      role: "Head of Sales",
      segment: "Enterprise",
      tags: ["Existing customer", "Power user"],
      notes: "From Q3 webinar",
    });
  });
});

// ── Parser↔Schema-Parität ─────────────────────────────────────────────────────

describe("Parser↔Schema-Parität", () => {
  it("every row the preview accepts passes PoolMemberSchema (no batch surprises)", () => {
    const corpus = [
      POOL_CSV_TEMPLATES.de.content,
      POOL_CSV_TEMPLATES.en.content,
      "Name,Email\n,jane@x.de\nNur Name,\n",
      'Name,Tags\nJane,"B2B; B2B , Founder,,Power-User"\n',
      `Name,Email\nGrenze,${"a".repeat(300)}@${"b".repeat(8)}.de\n`,
    ];
    for (const input of corpus) {
      const { parsed } = parsePoolCsv(input);
      for (const row of parsed) {
        const res = PoolMemberSchema.safeParse({
          contactLabel: row.contactLabel,
          contactEmail: row.contactEmail,
          role: row.role,
          segment: row.segment,
          tags: row.tags,
          notes: row.notes,
        });
        expect(res.success, `${row.contactLabel} / ${row.contactEmail}`).toBe(true);
      }
    }
  });
});
