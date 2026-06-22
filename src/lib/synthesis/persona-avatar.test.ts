import { describe, expect, it } from "vitest";

import { PERSONA_AVATAR_STYLE, personaAvatarUrl } from "./persona-avatar";

describe("personaAvatarUrl", () => {
  it("ist deterministisch für denselben Seed", () => {
    expect(personaAvatarUrl("Preisbewusste Sparfüchse")).toBe(
      personaAvatarUrl("Preisbewusste Sparfüchse"),
    );
  });

  it("ergibt unterschiedliche URLs für unterschiedliche Personas", () => {
    expect(personaAvatarUrl("Preisbewusste Sparfüchse")).not.toBe(
      personaAvatarUrl("Bequeme Sofort-Nutzer"),
    );
  });

  it("encodiert Leerzeichen und Sonderzeichen URL-sicher", () => {
    const url = personaAvatarUrl("Bequeme Sofort-Nutzer & Co");
    expect(url).not.toContain(" ");
    expect(url).toContain(encodeURIComponent("Bequeme Sofort-Nutzer & Co"));
  });

  it("nutzt den Notionists-Stil und fällt bei leerem Seed auf einen Default", () => {
    expect(personaAvatarUrl("x")).toContain(`/${PERSONA_AVATAR_STYLE}/`);
    expect(personaAvatarUrl("   ")).toContain("seed=persona");
  });
});
