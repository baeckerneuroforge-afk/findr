#!/usr/bin/env node
/**
 * Migration-Drift-Check (eingeführt 2026-07-02 nach dem business_context- +
 * org_branding-Vorfall).
 *
 * WARUM: Migrationen werden nach `main` gemergt → Vercel deployt den Code
 * SOFORT, aber die Migration wird nicht automatisch in die Prod-DB angewandt.
 * Fehlt sie, referenziert deployter Code eine Spalte/Tabelle, die es in Prod
 * nicht gibt → 400/500 (fail-closed Writes) oder stilles Fehlverhalten
 * (fail-open Reads). Genau das ist zweimal passiert (research_plans/org_settings
 * .business_context = P0; org_branding = still).
 *
 * WAS: Liest alle supabase/migrations/*.sql, rekonstruiert das NETTO-Schema
 * (add column / create table minus drop column / drop table, chronologisch) und
 * gibt eine SQL-Prüfung aus. Jede Zeile im Ergebnis = ein Objekt, das der
 * Repo-Code erwartet, das aber in Prod FEHLT.
 *
 * NUTZUNG (Teil des Merge-Flows, siehe AGENTS.md):
 *   node scripts/check-migration-drift.mjs
 * dann die ausgegebene SQL in Prod ausführen — via Supabase-MCP
 * (execute_sql) oder Supabase Studio → SQL Editor.
 *   • Leeres Ergebnis  = kein Drift, alles angewandt. ✅
 *   • Zeilen im Ergebnis = diese Migrationen sind in Prod NICHT angewandt.
 *
 * ABDECKUNG (bewusst begrenzt, deckt die reale Drift-Klasse — Spalten +
 * Tabellen — ab): erkennt `add column` / `create table` / `drop column` /
 * `drop table`. NICHT erfasst: Constraints, Funktionen/RPCs, RLS-Policies,
 * Storage-Buckets, Enum-Werte, reine Daten-Migrationen. Bei solchen Migrationen
 * zusätzlich manuell verifizieren.
 *
 * CAVEAT: Objekte, die eine spätere Migration bewusst wieder entfernt, sind
 * durch das Drop-Handling herausgerechnet — taucht trotzdem etwas Erwartetes
 * als fehlend auf, kurz gegen die jüngste Migration prüfen.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "migrations",
);

/** Zeilen-Kommentare entfernen, Statements splitten, Whitespace normalisieren. */
function statementsOf(sql) {
  return sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const TABLE = `"?(?:public\\.)?"?([a-z0-9_]+)"?`;

// Netto-Schema chronologisch rekonstruieren.
const cols = new Map(); // "table.col" -> { table, column, migration }
const tables = new Map(); // "table"     -> { table, migration }

for (const file of readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  const migration = file.replace(/\.sql$/, "");
  for (const s of statementsOf(readFileSync(join(MIGRATIONS_DIR, file), "utf8"))) {
    const create = s.match(new RegExp(`^create table (?:if not exists )?${TABLE}`, "i"));
    if (create) tables.set(create[1], { table: create[1], migration });

    const dropTable = s.match(new RegExp(`^drop table (?:if exists )?${TABLE}`, "i"));
    if (dropTable) {
      for (const t of dropTable.input
        .replace(/^drop table (?:if exists )?/i, "")
        .split(",")
        .map((x) => x.replace(/"|public\.|\s|cascade|restrict/gi, ""))) {
        tables.delete(t);
        for (const k of [...cols.keys()]) if (k.startsWith(`${t}.`)) cols.delete(k);
      }
    }

    const alter = s.match(new RegExp(`^alter table (?:if exists )?(?:only )?${TABLE}`, "i"));
    if (alter) {
      const table = alter[1];
      const add = /add column (?:if not exists )?"?([a-z0-9_]+)"?/gi;
      let m;
      while ((m = add.exec(s)) !== null)
        cols.set(`${table}.${m[1]}`, { table, column: m[1], migration });
      const drop = /drop column (?:if exists )?"?([a-z0-9_]+)"?/gi;
      while ((m = drop.exec(s)) !== null) cols.delete(`${table}.${m[1]}`);
    }
  }
}

const values = [
  ...[...cols.values()].map(
    (c) => `  ('col','${c.table}','${c.column}','${c.migration}')`,
  ),
  ...[...tables.values()].map((t) => `  ('tab','${t.table}',null,'${t.migration}')`),
].join(",\n");

process.stdout.write(`-- AUTO-GENERIERT von scripts/check-migration-drift.mjs (nicht editieren).
-- Jede zurückgegebene Zeile = Objekt aus dem Repo-Code, das in Prod FEHLT
-- (nicht-angewandte Migration). Leeres Ergebnis = kein Drift. ✅
with expected(kind, obj, col, from_migration) as (values
${values}
)
select * from (
  select e.from_migration, e.kind, e.obj, e.col,
    case when e.kind = 'col' then exists(
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = e.obj and c.column_name = e.col)
      else exists(
        select 1 from information_schema.tables t
        where t.table_schema = 'public' and t.table_name = e.obj)
    end as present
  from expected e
) x
where not present
order by from_migration, obj, col;
`);
