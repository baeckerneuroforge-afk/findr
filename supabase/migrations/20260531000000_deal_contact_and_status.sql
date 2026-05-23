-- Sprint: deal → interview, part 1 (data model only).
--
-- A deal needs contact details + an explicit outcome so a post-loss interview
-- can later be attached to it. This sprint ONLY adds the columns and the ability
-- to set them — no interview trigger, no sending.

alter table deals
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  -- Explicit close outcome, separate from the free-form `stage`. Marking a deal
  -- won/lost (which will also set closed_at) comes in the NEXT sprint; for now
  -- it just defaults to 'open'.
  add column if not exists outcome text not null default 'open'
    check (outcome in ('open', 'won', 'lost'));

-- closed_at already exists on deals (set by the Hubspot deal-update webhook).
-- Added idempotently so this migration is self-contained on a fresh database.
alter table deals
  add column if not exists closed_at timestamptz;

notify pgrst, 'reload schema';
