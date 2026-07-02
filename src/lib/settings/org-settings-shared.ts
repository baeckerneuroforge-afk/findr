/**
 * Client-sichere Konstanten rund um den Unternehmens-/Produkt-Kontext (E1/E3).
 * Eigenes Modul OHNE "server-only", damit Wizard-UI + Settings-Form denselben
 * Cap importieren können wie die server-seitigen Schemas (org-settings.ts,
 * Plan-/Guide-Routen). EINE Zahl end-to-end — Lehre aus dem persona-Cap-Bug.
 */
export const BUSINESS_CONTEXT_MAX_CHARS = 2000;
