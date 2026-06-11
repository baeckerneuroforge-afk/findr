import { z } from "zod";

import {
  MAX_POOL_EMAIL_LENGTH,
  MAX_POOL_LABEL_LENGTH,
  MAX_POOL_NOTES_LENGTH,
  MAX_POOL_ROLE_LENGTH,
  MAX_POOL_SEGMENT_LENGTH,
  MAX_POOL_TAGS,
  MAX_POOL_TAG_LENGTH,
} from "@/lib/csv/parse";

/**
 * Wire-Schema für einen Pool-Eintrag — verbatim aus POST /api/research/pool
 * extrahiert; wird dort UND von POST /api/research/pool/import verwendet,
 * damit Einzel-Anlage und CSV-Import nie auseinanderdriften. Die Feld-Limits
 * kommen als Konstanten aus lib/csv/parse.ts, wo auch die Client-Vorschau
 * gegen sie prüft — EINE Quelle, mechanisch geteilt statt per Kommentar
 * synchron gehalten (Label 200, E-Mail 320, Rolle/Segment 80, ≤30 Tags à 40,
 * Notizen 2000).
 *
 * Vorbestehende Semantik (bewusst unverändert, byte-identisch zu main):
 * der ''→null-Transform an contactEmail ist faktisch toter Code — .email()
 * läuft VOR dem Transform und weist "" bereits ab. Beide echten Clients
 * (Manager-Formular, CSV-Parser) normalisieren '' selbst zu null; ein Umbau
 * würde den Wire-Vertrag der bestehenden Pool-Route ändern.
 */
export const PoolMemberSchema = z.object({
  contactLabel: z.string().trim().min(1).max(MAX_POOL_LABEL_LENGTH),
  contactEmail: z
    .string()
    .trim()
    .email()
    .max(MAX_POOL_EMAIL_LENGTH)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  role: z
    .string()
    .trim()
    .max(MAX_POOL_ROLE_LENGTH)
    .nullable()
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  segment: z
    .string()
    .trim()
    .max(MAX_POOL_SEGMENT_LENGTH)
    .nullable()
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  tags: z
    .array(z.string().trim().min(1).max(MAX_POOL_TAG_LENGTH))
    .max(MAX_POOL_TAGS)
    .optional()
    .transform((arr) => (arr ? [...new Set(arr)] : [])),
  notes: z
    .string()
    .trim()
    .max(MAX_POOL_NOTES_LENGTH)
    .nullable()
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});
