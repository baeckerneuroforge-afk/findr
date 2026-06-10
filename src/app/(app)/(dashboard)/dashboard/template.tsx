/**
 * Konsole-v5 (E1): Eintritts-Choreografie beim Bereichswechsel.
 *
 * template.tsx remountet bei jedem Wechsel des Kind-Segments unter
 * /dashboard (Heute ↔ Market Research ↔ Insights ↔ Settings …) — dadurch
 * spielt die rise-Animation pro Navigation und greift auch auf den
 * loading.tsx-Skeletons (Skeleton tritt weich ein, Inhalt ersetzt in
 * place). Reine Hülle ohne Logik, Server Component.
 *
 * Bewusst NICHT auf (dashboard)-Ebene: dort wäre das Kind-Segment immer
 * "dashboard" und der Key würde nie wechseln (keine Animation).
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="animate-console-rise">{children}</div>;
}
