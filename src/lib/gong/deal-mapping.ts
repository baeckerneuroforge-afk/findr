import type { Deal } from "@/lib/deals/types";
import type { NormalizedGongCall } from "./service";

export interface GongDealMapping {
  dealId: string | null;
  method: "title_company_match" | "title_deal_match" | "participant_domain_match" | "none";
  confidence: number;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function companyTokens(companyName: string): string[] {
  return normalize(companyName)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 4 &&
        !["gmbh", "inc", "ag", "ltd", "llc", "corp", "company"].includes(token),
    );
}

function emailDomain(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  const root = domain.split(".")[0];
  return root && !["gmail", "googlemail", "outlook", "hotmail"].includes(root)
    ? root
    : null;
}

export function mapGongCallToDeal(
  call: NormalizedGongCall,
  deals: Deal[],
): GongDealMapping {
  const title = normalize(call.title ?? "");
  const participantDomains = call.participants
    .map((participant) => participant.email)
    .filter((email): email is string => Boolean(email))
    .map(emailDomain)
    .filter((domain): domain is string => Boolean(domain));

  let best: GongDealMapping = {
    dealId: null,
    method: "none",
    confidence: 0,
  };

  for (const deal of deals) {
    const normalizedDealName = normalize(deal.name.split("—")[0] ?? deal.name);
    if (normalizedDealName.length >= 4 && title.includes(normalizedDealName)) {
      return {
        dealId: deal.id,
        method: "title_deal_match",
        confidence: 0.92,
      };
    }

    const tokens = companyTokens(deal.companyName);
    const titleMatches = tokens.filter((token) => title.includes(token)).length;
    if (titleMatches > 0) {
      const confidence = Math.min(0.9, 0.68 + titleMatches * 0.1);
      if (confidence > best.confidence) {
        best = {
          dealId: deal.id,
          method: "title_company_match",
          confidence,
        };
      }
    }

    const domainMatches = tokens.filter((token) =>
      participantDomains.some((domain) => domain.includes(token) || token.includes(domain)),
    ).length;
    if (domainMatches > 0 && best.confidence < 0.65) {
      best = {
        dealId: deal.id,
        method: "participant_domain_match",
        confidence: 0.62,
      };
    }
  }

  return best.confidence >= 0.6
    ? best
    : { dealId: null, method: "none", confidence: 0 };
}
