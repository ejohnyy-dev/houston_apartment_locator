import { describe, it, expect } from "vitest";
import { redactEmail } from "./redactEmail";

describe("redactEmail", () => {
  it("masks everything between the first character and the @ symbol", () => {
    expect(redactEmail("john.doe@example.com")).toBe("j***@example.com");
  });

  it("handles short local parts", () => {
    expect(redactEmail("a@b.com")).toBe("a***@b.com");
  });

  it("handles emails with plus addresses", () => {
    expect(redactEmail("user+tag@domain.org")).toBe("u***@domain.org");
  });

  it("returns the same string when there is no @ symbol", () => {
    expect(redactEmail("not-an-email")).toBe("not-an-email");
  });
});
