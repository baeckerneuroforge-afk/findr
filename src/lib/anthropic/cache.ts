import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

/**
 * Prompt-Caching-Helfer für agentische Loops (Konsoul-Orchestrator,
 * Cross-Study-Agent) — dasselbe Muster wie der Interview-Turn
 * (voice-agent/interviewer.ts): pro API-Call ein Cache-Breakpoint auf dem
 * letzten STABILEN Message-Block, sodass jeder Loop-Step den gecachten Präfix
 * des vorherigen Steps VERLÄNGERT statt ihn neu zu bezahlen. Ohne das zahlt
 * ein 10-Step-Loop den kompletten, wachsenden Kontext (System + Tools +
 * History inkl. großer Tool-Results) jede Runde voll als Input.
 *
 * Semantik:
 *  - Gibt eine flach kopierte messages-Liste zurück; die Originale (die der
 *    Loop weiter mutiert/erweitert) bleiben unberührt — insbesondere sammeln
 *    sich KEINE cache_control-Marker über die Steps an (API-Limit: max. 4
 *    Breakpoints pro Request).
 *  - Der Breakpoint sitzt auf dem letzten Content-Block der LETZTEN Message.
 *    An jeder Callsite der Loops ist das eine user-Message (Frage, Nudge oder
 *    tool_results) — also genau der Punkt, bis zu dem der nächste Step
 *    denselben Präfix wiederverwendet.
 *  - String-Content wird dafür in einen äquivalenten text-Block gehoben
 *    (cache_control existiert nur auf Block-Ebene).
 *  - Kurze frühe Steps unterschreiten ggf. die Mindest-Cache-Länge des
 *    Modells — das überspringt das Caching still, nie ein Fehler.
 */
export function withCacheBreakpointOnLastMessage(
  messages: Anthropic.MessageParam[],
): Anthropic.MessageParam[] {
  if (messages.length === 0) return messages;
  return messages.map((message, index) => {
    if (index !== messages.length - 1) return message;
    const blocks: Anthropic.ContentBlockParam[] =
      typeof message.content === "string"
        ? [{ type: "text", text: message.content }]
        : message.content.map((block) => ({ ...block }));
    if (blocks.length === 0) return message;
    blocks[blocks.length - 1] = {
      ...blocks[blocks.length - 1],
      cache_control: { type: "ephemeral" },
    } as Anthropic.ContentBlockParam;
    return { ...message, content: blocks };
  });
}

/**
 * System-Prompt als Block-Array mit Cache-Breakpoint. In der Cache-Reihenfolge
 * der API (tools → system → messages) deckt dieser eine Breakpoint auch die
 * Tool-Definitionen davor mit ab.
 */
export function cachedSystem(
  text: string,
): Array<Anthropic.TextBlockParam> {
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}
