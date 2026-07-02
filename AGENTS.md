<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Migrationen sind Teil des Merge-Flows (NICHT optional)

Vercel deployt `main` automatisch — **der Code geht sofort live, die DB-Migration NICHT.** Wird ein PR mit neuen `supabase/migrations/*.sql` gemergt, ohne die Migration in Prod anzuwenden, referenziert deployter Code fehlende Spalten/Tabellen → 400/500 (fail-closed Writes) oder stilles Fehlverhalten (fail-open Reads). Genau das ist am 2026-07-02 passiert (`business_context` = plattformweiter P0 beim Studien-Erstellen; `org_branding` war seit Wochen still kaputt).

Deshalb, bei JEDEM Merge mit Schema-Änderung:

1. **Migration in Prod anwenden** (Supabase-MCP `apply_migration`, Name = Repo-Dateiname) — idealerweise VOR oder direkt MIT dem Merge, nie danach vergessen.
2. **Drift-Check laufen lassen:** `node scripts/check-migration-drift.mjs` → ausgegebene SQL in Prod ausführen (MCP `execute_sql` oder Supabase Studio). **Leeres Ergebnis = kein Drift.** Jede Zeile = nicht-angewandte Migration.
3. Reads defensiv **fail-open** halten (Fehler → Default), damit ein Deploy-vor-Migration-Fenster nicht sofort crasht (Muster: `getOrgBusinessContext`, `getInterviewRetentionDays`).
