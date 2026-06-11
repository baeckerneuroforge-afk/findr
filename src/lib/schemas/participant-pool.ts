import { z } from "zod";

/**
 * Wire-Schema für einen Pool-Eintrag — Single Source of Truth für die
 * Feld-Limits (Label 1–200, Rolle/Segment ≤80, ≤30 Tags à ≤40, Notizen
 * ≤2000). Verbatim aus POST /api/research/pool extrahiert; wird dort UND von
 * POST /api/research/pool/import verwendet, damit Einzel-Anlage und
 * CSV-Import nie auseinanderdriften.
 */
export const PoolMemberSchema = z.object({
  contactLabel: z.string().trim().min(1).max(200),
  contactEmail: z
    .string()
    .trim()
    .email()
    .max(320)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  role: z
    .string()
    .trim()
    .max(80)
    .nullable()
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  segment: z
    .string()
    .trim()
    .max(80)
    .nullable()
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(30)
    .optional()
    .transform((arr) => (arr ? [...new Set(arr)] : [])),
  notes: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});
