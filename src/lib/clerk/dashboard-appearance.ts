/**
 * Clerk-Appearance der Dashboard-Flächen, pro Farbmodus. Die `variables`
 * sind Literal-Hex, weil Clerk sie in eigenes CSS-in-JS gießt — sie können
 * die .dark-CSS-Variablen der Shell NICHT erben und müssen deshalb beide
 * Token-Sets aus globals.css spiegeln (light = Hellwerte, dark = .dark-Block).
 * Die `elements`-Klassen dagegen sind Tailwind-Utilities und drehen über die
 * Variablen automatisch mit, solange die Komponente IM ThemeShell-Wrapper
 * rendert (Profile-Seiten ja; der UserButton-Popover portalt nach body und
 * hängt daher allein an den variables).
 */

const SHARED_VARIABLES = {
  borderRadius: "0.5rem",
  fontFamily: "var(--font-geist-sans), system-ui",
};

const SHARED_ELEMENTS = {
  rootBox: "w-full",
  cardBox: "shadow-none border border-neutral-200 rounded-lg",
  card: "shadow-none",
  navbar: "bg-neutral-50 border-r border-neutral-200",
  navbarButton: "text-neutral-600 hover:text-neutral-900",
  navbarButtonIcon: "text-neutral-500",
  navbarButtonActive: "bg-card text-primary-700",
  formButtonPrimary:
    "bg-primary-600 hover:bg-primary-hover text-white normal-case",
  formFieldInput:
    "border-neutral-200 focus:border-primary-500 focus:ring-primary-500/10",
  profileSectionPrimaryButton:
    "bg-primary-600 hover:bg-primary-hover text-white normal-case",
};

const LIGHT_APPEARANCE = {
  variables: {
    ...SHARED_VARIABLES,
    colorPrimary: "#4a51a8",
    colorBackground: "#ffffff",
    colorText: "#18181b",
    colorTextSecondary: "#71717a",
    colorInputBackground: "#ffffff",
    colorInputText: "#18181b",
    colorNeutral: "#71717a",
  },
  elements: SHARED_ELEMENTS,
};

const DARK_APPEARANCE = {
  variables: {
    ...SHARED_VARIABLES,
    colorPrimary: "#5e65c0",
    colorBackground: "#1d1925",
    colorText: "#f2eff6",
    colorTextSecondary: "#9c92ad",
    colorInputBackground: "#16121d",
    colorInputText: "#f2eff6",
    colorNeutral: "#9c92ad",
  },
  elements: SHARED_ELEMENTS,
};

export function klymeoDashboardClerkAppearance(dark: boolean) {
  return dark ? DARK_APPEARANCE : LIGHT_APPEARANCE;
}
