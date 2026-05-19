-- Allow text deal_ids for mock data
alter table calls drop constraint if exists calls_deal_id_fkey;
alter table calls alter column deal_id type text using deal_id::text;
