import { describe, expect, it } from "vitest";

import {
  parseBulkInput,
  parseCsvInput,
  parsePoolCsv,
} from "./parse";

/**
 * Golden-Tests für die aus BulkInviteForm extrahierten Parser: Abschnitt 1+2
 * pinnen das BESTEHENDE Verhalten (Extraktion darf nichts ändern), Abschnitt 3
 * spezifiziert den neuen Pool-Parser.
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
});
