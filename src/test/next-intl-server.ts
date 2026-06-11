/**
 * Test stub for `next-intl/server`.
 *
 * `next-intl/server` ships conditional exports keyed on the `react-server`
 * export condition: inside Next.js' App Router server graph that condition is
 * set and the import resolves to the real server implementation. In Vitest's
 * `node` environment the condition is absent, so the same import resolves to
 * next-intl's *client* build, whose `getTranslations`/`getLocale` throw
 * "`getTranslations` is not supported in Client Components." the moment they run.
 *
 * Route handlers (`route.ts`) legitimately call `getTranslations` and only ever
 * execute in the server graph in production, so this is purely a
 * test-environment module-resolution gap — not a production bug. We alias
 * `next-intl/server` to this stub in `vitest.config.ts` (mirroring the existing
 * `server-only` alias) so server-context helpers resolve to no-throw test
 * doubles. Route tests assert on status codes / structured bodies / `err.message`
 * and never on a translated string, so `t(key)` simply echoes the key.
 */

type TranslateValues = Record<string, unknown>;

type Translator = ((key: string, values?: TranslateValues) => string) & {
  rich: (key: string, values?: TranslateValues) => string;
  markup: (key: string, values?: TranslateValues) => string;
  raw: (key: string) => string;
  has: (key: string) => boolean;
};

function createTranslator(): Translator {
  const t = ((key: string) => key) as Translator;
  t.rich = (key) => key;
  t.markup = (key) => key;
  t.raw = (key) => key;
  t.has = () => true;
  return t;
}

export async function getTranslations(
  _namespaceOrOptions?: string | { locale?: string; namespace?: string },
): Promise<Translator> {
  return createTranslator();
}

// Mirrors DEFAULT_LOCALE in src/i18n/locale.ts; not asserted by any test.
export async function getLocale(): Promise<string> {
  return "en";
}

// Plugin-config helper: next-intl wires `i18n/request.ts`'s default export
// through this at framework boot, never during tests. Passthrough keeps the
// named export resolvable if a test ever pulls that module transitively.
export function getRequestConfig<T>(loadConfig: T): T {
  return loadConfig;
}
