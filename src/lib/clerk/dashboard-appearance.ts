export const findrDashboardClerkAppearance = {
  variables: {
    colorPrimary: "#4f46e5",
    colorBackground: "#ffffff",
    colorText: "#18181b",
    colorTextSecondary: "#71717a",
    colorInputBackground: "#ffffff",
    colorInputText: "#18181b",
    colorNeutral: "#71717a",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-geist-sans), system-ui",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-none border border-neutral-200 rounded-lg",
    card: "shadow-none",
    navbar: "bg-neutral-50 border-r border-neutral-200",
    navbarButton: "text-neutral-600 hover:text-neutral-900",
    navbarButtonIcon: "text-neutral-500",
    navbarButtonActive: "bg-white text-primary-700",
    formButtonPrimary:
      "bg-primary-600 hover:bg-primary-700 text-white normal-case",
    formFieldInput:
      "border-neutral-200 focus:border-primary-500 focus:ring-primary-500/10",
    profileSectionPrimaryButton:
      "bg-primary-600 hover:bg-primary-700 text-white normal-case",
  },
};
