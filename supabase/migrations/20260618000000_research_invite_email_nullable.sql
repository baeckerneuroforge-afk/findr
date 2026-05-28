-- Make research_invites.contact_email explicitly nullable.
--
-- Status today: the original research_layer migration (20260611000000) declared
--
--     contact_email text
--
-- WITHOUT a `not null` clause, so the column is *already* nullable in prod.
-- This migration is intentionally idempotent — a `DROP NOT NULL` on an
-- already-nullable column is a no-op in Postgres ≥ 11 (the planner skips
-- the catalog rewrite). We still ship it as the explicit, reviewable
-- contract: from this point on, "contact_email may be null" is a
-- migration-grounded guarantee, not just an artifact of the original CREATE
-- TABLE.
--
-- Why we need the explicit guarantee:
-- The participant-flow change (feat/participant-flow) lets Findr users add
-- participants without an email — the API/UI now treat email as truly
-- optional (a participant added via bulk-paste with just a name still gets a
-- pending invite row + access_token). The Send-Invite button is gated by
-- contact_email at the API layer (mail can't go out without an address), but
-- Link-Copy + Schedule + Delete all work without it.
--
-- The original column comment ("Email und Name separat, damit die Email
-- indexier-/maskierbar bleibt." in 20260611) already implied optionality,
-- since indexing-optional fields are usually nullable. This migration just
-- nails it down.
--
-- No data migration needed — pre-existing rows with email already have it,
-- and rows without it were already storing null.

alter table research_invites
  alter column contact_email drop not null;

comment on column research_invites.contact_email is
  'Optional. Required for sending the invite mail (gated at the API layer), '
  'but participants can be added/scheduled/link-shared without it. '
  'Made explicitly nullable by migration 20260618 — the original DDL in '
  '20260611 already lacked NOT NULL; this is the explicit contract.';
