/**
 * Shared Findr theme for Clerk's auth components.
 * Used by both /sign-in and /sign-up pages.
 *
 * Note: `elements` keys reference Clerk's internal class names; the values are
 * Tailwind utility strings that get appended to Clerk's defaults.
 */
export const findrAuthAppearance = {
  variables: {
    colorPrimary: "#6D28D9",          // violet-600
    colorBackground: "#16101E",       // obsidian
    colorText: "#FFFFFF",
    colorInputBackground: "#1F1731",  // obsidian-light
    colorInputText: "#FFFFFF",
    colorTextSecondary: "#C4B5FD",    // mist
    colorNeutral: "#C4B5FD",
    borderRadius: "0.5rem",           // rounded-lg
  },
  elements: {
    rootBox: "flex justify-center",
    card: "bg-obsidian-light border border-mist/15 shadow-2xl",
    headerTitle: "text-white text-2xl font-medium",
    headerSubtitle: "text-mist",
    formButtonPrimary:
      "bg-violet-600 hover:bg-violet-700 text-white font-medium normal-case",
    formFieldInput: "bg-obsidian border border-mist/15 text-white",
    formFieldLabel: "text-mist text-sm",
    socialButtonsBlockButton: "border border-mist/15 hover:bg-mist/5",
    socialButtonsBlockButtonText: "text-white",
    dividerLine: "bg-mist/15",
    dividerText: "text-mist",
    footerActionLink: "text-violet-400 hover:text-violet-300",
    identityPreviewText: "text-white",
    identityPreviewEditButton: "text-violet-400",
  },
};
