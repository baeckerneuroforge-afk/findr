/**
 * Single visibility switchboard for dashboard product modules.
 *
 * Flip a module value to `true` to make it visible again in dashboard navigation,
 * dashboard entry points, and its guarded UI routes. Backend APIs and services do
 * not read this file and remain unchanged.
 */
export const ENABLED_MODULES = {
  marketResearch: true,
  insights: true,
  salesIntelligence: false,
  csHealth: false,
  productDiscovery: false,
} as const;

export type DashboardModuleKey = keyof typeof ENABLED_MODULES;
