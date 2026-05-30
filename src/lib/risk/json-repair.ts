/**
 * Narrow quote-escape repair for the risk classifier's TEXT-JSON transport.
 * ------------------------------------------------------------------------
 * Risk DELIBERATELY stays on the text-JSON path (callClaude + JSON.parse),
 * unlike the 12 other AI modules that moved to forced tool-use. Reason: forced
 * tool-use shifts Opus' risk *calibration* systematically upward — the full risk
 * eval went 38/50 under tool-use vs the ~94% text-JSON baseline, and even a
 * reasoning-first schema reorder (signals/reasoning before riskScore) did NOT
 * recover it. The upward shift is the tool-use generation MODE itself, not a
 * fixable prompt/schema detail. So we keep the proven text-JSON scoring and
 * close ONLY the real crash that path carries.
 *
 * THE CRASH CLASS (the only thing this repair targets): the model emits a
 * deliverable like
 *     "quotes": ["Der CFO sagte "das Budget ist eingefroren" und blockierte"]
 * where a verbatim DACH transcript snippet in signals[].quotes contains
 * UNESCAPED double quotes inside the JSON string value. JSON.parse then throws
 * ("returned invalid JSON twice"). risk is especially exposed because quotes[]
 * holds raw buyer language, which routinely contains quotation marks.
 *
 * This is NOT a general JSON fixer and does NOT rewrite structure. It does
 * exactly one thing, and ONLY when JSON.parse has already failed: scan the text
 * and escape double quotes that sit INSIDE a string value — a `"` that is not a
 * legitimate string terminator. A terminator is a `"` followed, past optional
 * whitespace, by one of `:` `,` `}` `]` or end-of-input. Everything else inside
 * a string is treated as embedded text and escaped.
 *
 * SAFETY: valid JSON never reaches the repair (see parseJsonWithQuoteRepair), so
 * the repair can NEVER corrupt a payload that already parses — scores are
 * byte-identical on every case the model returns cleanly. A payload the repair
 * cannot fix still throws, and the caller keeps its existing retry +
 * LLMUnavailableError fail-closed behaviour. Worst case = today's behaviour.
 */

/**
 * Escape unescaped `"` that appear inside JSON string values. Structural quotes
 * (a string's opening quote, and its closing quote before `:` `,` `}` `]` / EOF)
 * are preserved. Already-escaped sequences (`\"`, `\\`, …) are copied verbatim.
 */
export function escapeUnescapedQuotesInStrings(input: string): string {
  let out = "";
  let inString = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }

    // --- inside a string value ---
    if (ch === "\\") {
      // Escape sequence: copy the backslash and the char it escapes verbatim.
      out += ch;
      if (i + 1 < input.length) {
        out += input[i + 1];
        i++;
      }
      continue;
    }

    if (ch === '"') {
      // Legitimate terminator, or an embedded quote? Look past whitespace to the
      // next significant char; a real value/key end is followed by : , } ] / EOF.
      let j = i + 1;
      while (
        j < input.length &&
        (input[j] === " " ||
          input[j] === "\t" ||
          input[j] === "\n" ||
          input[j] === "\r")
      ) {
        j++;
      }
      const next = j < input.length ? input[j] : undefined;
      if (
        next === undefined ||
        next === ":" ||
        next === "," ||
        next === "}" ||
        next === "]"
      ) {
        out += ch; // terminator — close the string
        inString = false;
      } else {
        out += '\\"'; // embedded quote inside the value — escape it
      }
      continue;
    }

    out += ch;
  }

  return out;
}

/**
 * Parse JSON, attempting the narrow quote-escape repair ONLY if the raw text
 * fails to parse as-is. Valid JSON is returned untouched (the repair never runs
 * on it), so this can never change a payload that already parses. Throws (like
 * JSON.parse) when even the repaired text is invalid — callers keep fail-closed.
 */
export function parseJsonWithQuoteRepair(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(escapeUnescapedQuotesInStrings(raw));
  }
}
