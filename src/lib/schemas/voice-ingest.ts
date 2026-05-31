import { z } from "zod";

/**
 * Findr Voice — Ingest-Request + Zuordnungs-Schema (Etappe 1).
 *
 * DISAMBIGUIERUNG IST STRUKTURELL, nicht laufzeit-geprüft. Jede Variante der
 * `assignment`-discriminated-union trägt GENAU das eine Ziel-Feld, das ihre
 * Engine braucht — es gibt KEIN frei schwebendes (targetType, targetId)-Paar.
 * Eine inkonsistente Kombination (z.B. "sales_call" + accountId) ist damit
 * UNREPRÄSENTIERBAR; der Router schaltet auf `kind` und trifft genau eine
 * Engine. Die calls-XOR (account_id XOR deal_id) wird per Konstruktion erfüllt,
 * weil jeder Engine-Eintritt nur seinen eigenen Parent setzt:
 *   existing_customer → analyzeAccountTranscript (account_id)
 *   sales_call        → calls.deal_id + analyzeDealRiskWithFallback
 *   discovery         → persistResearchTranscriptAndDiscovery (beide null)
 */

const ExistingCustomer = z.object({
  kind: z.literal("existing_customer"),
  accountId: z.string().uuid(),
});
const SalesCall = z.object({
  kind: z.literal("sales_call"),
  dealId: z.string().uuid(),
});
const Discovery = z.object({
  kind: z.literal("discovery"),
  planId: z.string().uuid(),
});
const Inbox = z.object({ kind: z.literal("inbox") });

/** Vollständige Zuordnung inkl. "später zuordnen" (inbox). */
export const AssignmentSchema = z.discriminatedUnion("kind", [
  ExistingCustomer,
  SalesCall,
  Discovery,
  Inbox,
]);
export type Assignment = z.infer<typeof AssignmentSchema>;

/**
 * Die zuordenbaren Varianten OHNE `inbox` — das nimmt die Posteingang-
 * "assign"-Action entgegen (man kann ein Item nicht in den Posteingang
 * zuordnen; dort liegt es bereits). Spiegelt AssignmentSchema minus Inbox.
 */
export const RoutableAssignmentSchema = z.discriminatedUnion("kind", [
  ExistingCustomer,
  SalesCall,
  Discovery,
]);
export type RoutableAssignment = z.infer<typeof RoutableAssignmentSchema>;

const SegmentSchema = z.object({
  speaker: z.string().trim().min(1).max(200),
  text: z.string(),
  tStart: z.number().nonnegative().optional(),
});

/**
 * Ingest-Body von `POST /api/voice/ingest`. KEIN orgId — der ist
 * server-autoritativ (aus dem Bearer-Token). Spiegelt das `.omit({orgId})`-
 * Muster der bestehenden Routes.
 */
export const VoiceIngestSchema = z.object({
  // Gleicher Cap wie AnalyzeTranscriptSchema (Health) — der Text geht direkt
  // in die Engines, und die Caps schützen vor token-burning durch hostile Clients.
  transcriptText: z.string().trim().min(1).max(100_000),
  // Idempotenz-Schlüssel des Clients (z.B. Recall-Meeting-ID).
  externalMeetingId: z.string().trim().min(1).max(200),
  recordedAt: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().datetime().optional(),
  ),
  durationSeconds: z.coerce.number().int().min(0).max(86_400).optional(),
  // Sprecher-getrennte Segmente sind optionale Metadaten; die Engines parsen
  // Sprecher-Prefixe aus transcriptText, daher werden Segmente nur zur
  // Nachvollziehbarkeit gespeichert.
  segments: z.array(SegmentSchema).max(5_000).optional(),
  assignment: AssignmentSchema,
});
export type VoiceIngestInput = z.infer<typeof VoiceIngestSchema>;

/** Body der Posteingang-"assign"-Action: nur die zuordenbaren Varianten. */
export const AssignInboxSchema = z.object({
  assignment: RoutableAssignmentSchema,
});
export type AssignInboxInput = z.infer<typeof AssignInboxSchema>;
