/**
 * Wire types for the global Cmd+K search index. The shape is deliberately
 * lean: only the fields the palette needs to render a row AND to match a
 * substring search against. We do NOT echo full Deal / Account objects out
 * over the network — pricing, contact details, MRR etc. have no business in
 * a palette payload, and keeping the shape small lets the lazy first-open
 * hydration stay fast even on larger orgs.
 *
 * Hydration is one-shot per session (lazy, fetched the first time the
 * palette opens), so all volume tradeoffs cluster around this single
 * response. At typical org sizes (~50–500 deals, ~50–500 accounts) a
 * single in-memory snapshot is the right tradeoff over per-keystroke
 * server queries.
 */

export interface SearchableDeal {
  id: string;
  /** Deal name as shown on the deal-detail page (e.g. "Acme Q1 Renewal"). */
  name: string;
  /** Underlying customer company. May match the deal name or be distinct. */
  companyName: string;
  /** Deal stage label (negotiation, proposal_sent, …). Surfaced in the row
   *  as a small contextual label so users disambiguate dupes at a glance. */
  stage: string;
}

export interface SearchableAccount {
  id: string;
  companyName: string;
  /** Primary sponsor / contact on the account side. Nullable in the source
   *  table so we honour that here. */
  sponsorName: string | null;
  /** Account status (active / at_risk / churned). Same contextual-row role
   *  as `stage` on the deal side. */
  status: string;
}

/** Markt-Studie in der Palette (Konsole-v5): id + Titel + Status-Label —
 *  dieselbe Lean-Shape-Disziplin wie Deals/Accounts. */
export interface SearchableStudy {
  id: string;
  title: string;
  /** Plan-Status (draft / active / completed / archived) — Kontext-Label
   *  rechts in der Zeile, übersetzt im Client. */
  status: string;
}

/** The hydration endpoint's response shape — flat per entity, no nesting. */
export interface SearchIndex {
  deals: SearchableDeal[];
  accounts: SearchableAccount[];
  studies: SearchableStudy[];
}
