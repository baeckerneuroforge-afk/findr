/**
 * Sicherheitsnetz: Bei Soft-Navigation auf andere Unterrouten dieser Ebene
 * (z. B. /test) würde der Slot sonst seinen letzten aktiven Zustand
 * behalten — der Catch-all schließt den Drawer stattdessen.
 */
export default function CatchAll() {
  return null;
}
