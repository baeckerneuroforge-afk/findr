import { z } from "zod";

export const HubspotDealSchema = z.object({
  id: z.string(),
  properties: z.object({
    dealname: z.string().nullable().optional(),
    amount: z.string().nullable().optional(),
    dealstage: z.string().nullable().optional(),
    pipeline: z.string().nullable().optional(),
    hubspot_owner_id: z.string().nullable().optional(),
    closedate: z.string().nullable().optional(),
    createdate: z.string().nullable().optional(),
    hs_lastmodifieddate: z.string().nullable().optional(),
    deal_currency_code: z.string().nullable().optional(),
  }),
  associations: z
    .object({
      companies: z
        .object({
          results: z.array(z.object({ id: z.string() })),
        })
        .optional(),
    })
    .optional(),
});

export const HubspotCompanySchema = z.object({
  id: z.string(),
  properties: z.object({
    name: z.string().nullable().optional(),
    domain: z.string().nullable().optional(),
    industry: z.string().nullable().optional(),
  }),
});

export const HubspotOwnerSchema = z.object({
  id: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
});

export const HubspotTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  token_type: z.string(),
  hub_id: z.number().optional(),
});

export const HubspotTokenIntrospectionSchema = z.object({
  hub_id: z.number().optional(),
  hubId: z.number().optional(),
  user_id: z.number().optional(),
  userId: z.number().optional(),
});

export type HubspotDeal = z.infer<typeof HubspotDealSchema>;
export type HubspotCompany = z.infer<typeof HubspotCompanySchema>;
export type HubspotOwner = z.infer<typeof HubspotOwnerSchema>;
