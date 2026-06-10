/**
 * E7b (Konsole-v5): Layout der Studien-Detailebene mit @drawer-Slot.
 * `drawer` rendert normalerweise default.tsx (null); bei Soft-Navigation
 * auf eine Session interceptet @drawer/(.)sessions/[sessionId] die Route
 * und legt das Transkript als Drawer über die Seite — Hard-Load/Deep-Link
 * derselben URL rendert weiterhin die Voll-Seite.
 */
export default function MarketCampaignDetailLayout({
  children,
  drawer,
}: {
  children: React.ReactNode;
  drawer: React.ReactNode;
}) {
  return (
    <>
      {children}
      {drawer}
    </>
  );
}
