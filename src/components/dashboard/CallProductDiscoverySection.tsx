import { AnalyzeProductDiscoveryButton } from "./AnalyzeProductDiscoveryButton";
import { ProductDiscoveryPanel } from "./ProductDiscoveryPanel";
import type { ProductDiscoveryInsightRecord } from "@/lib/product-discovery/service";

/**
 * Per-call Product Discovery section: the trigger button on top, the latest
 * stored insight (if any) below. Server component — the button is the only
 * client-side piece, rendered inside this server shell. Pages use a single
 * `<CallProductDiscoverySection callId insight />` per call instead of
 * inlining button + panel layout twice across Deal-Detail and Account-Detail.
 *
 * insight === null is a valid state (call hasn't been analysed yet); the
 * button alone suffices then. The panel only renders once there's something
 * persisted to show — including 0/0/0 results, which the panel surfaces as
 * an explicit "no findings" hint rather than collapsing silently.
 */
export function CallProductDiscoverySection({
  callId,
  insight,
}: {
  callId: string;
  insight: ProductDiscoveryInsightRecord | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <AnalyzeProductDiscoveryButton
          callId={callId}
          hasInsights={insight !== null}
        />
      </div>
      {insight && <ProductDiscoveryPanel insight={insight} />}
    </div>
  );
}
