-- Cleanup — drop the legacy, unused crm_connections table.
--
-- crm_connections was an early generic OAuth-token store that no live code path
-- reads or writes (the HubSpot/Gong integrations have their own tables). It
-- carried plaintext OAuth tokens and only added attack surface. Its sole FK is
-- its own org_id → organizations, and nothing references it, so a plain drop is
-- safe. The dynamic export/delete SQL functions loop information_schema live, so
-- they adapt automatically once the table is gone.
drop table if exists crm_connections;
