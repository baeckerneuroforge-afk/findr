import "server-only";

import { prolificProvider } from "./prolific";
import type { PanelProvider, PanelProviderKey } from "./providers";

/**
 * Provider-Registry (E8) — die EINE Stelle, an der ein neuer Panel-Anbieter
 * angemeldet wird. Der Service löst Provider ausschließlich hierüber auf;
 * die DB-CHECK-Constraints auf provider sind seit 20260706000000 geweitet,
 * sodass ein zweiter Anbieter NUR noch braucht:
 *   1. Eintrag in PANEL_PROVIDER_KEYS (providers.ts) → Typ-Union wächst,
 *   2. Provider-Objekt + Registry-Eintrag hier,
 *   3. UI-Flächen (Integrations-Seite, Provider-Card) — Selector-UI laut
 *      Plan erst, wenn der zweite Anbieter real ist.
 * Kein Schema-Schnitt, keine Service-Änderung.
 */
export const PANEL_PROVIDERS: Record<PanelProviderKey, PanelProvider> = {
  prolific: prolificProvider,
};

export function getPanelProvider(key: PanelProviderKey): PanelProvider {
  return PANEL_PROVIDERS[key];
}
