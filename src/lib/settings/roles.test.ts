import { describe, expect, it } from "vitest";
import { isAdminRole, validateDeleteConfirmation } from "./roles";

describe("isAdminRole", () => {
  it("accepts Clerk admin-style roles", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("org:admin")).toBe(true);
    expect(isAdminRole("organization:owner")).toBe(true);
  });

  it("rejects missing and non-admin roles", () => {
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole("member")).toBe(false);
    expect(isAdminRole("org:member")).toBe(false);
  });
});

describe("validateDeleteConfirmation", () => {
  it("requires the exact organization name after trimming", () => {
    expect(validateDeleteConfirmation(" Acme GmbH ", "Acme GmbH")).toBe(true);
    expect(validateDeleteConfirmation("acme gmbh", "Acme GmbH")).toBe(false);
  });

  it("rejects missing confirmation text", () => {
    expect(validateDeleteConfirmation(null, "Acme GmbH")).toBe(false);
    expect(validateDeleteConfirmation(undefined, "Acme GmbH")).toBe(false);
  });
});
