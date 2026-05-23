-- Sprint: async post-loss interview — explicit per-session language.
--
-- The agent must open AND run the whole conversation in a known language. On the
-- very first message there is no buyer reply to mirror yet, so without this the
-- opening question sometimes came out in English even for German deals. We store
-- the preferred language on the session and feed it to the interviewer from the
-- first message on. Buyer-visible messages follow this; the final extraction is
-- unaffected (it may keep working internally in English).

alter table interview_sessions
  add column if not exists language text not null default 'en'
    check (language in ('de', 'en'));

notify pgrst, 'reload schema';
