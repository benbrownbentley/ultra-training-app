import { describe, expect, it } from "vitest";

import { checkPassword, PASSWORD_MIN_LENGTH } from "./auth-constants";

describe("checkPassword", () => {
  it("accepts a password with length, a letter, and a number", () => {
    expect(checkPassword("trail2026")).toEqual({
      ok: true,
      hasLength: true,
      hasLetter: true,
      hasNumber: true,
    });
  });

  it("rejects a password shorter than the minimum", () => {
    const result = checkPassword("ab12");
    expect(result.ok).toBe(false);
    expect(result.hasLength).toBe(false);
  });

  it("rejects an all-letter password (missing a number)", () => {
    const result = checkPassword("longpassword");
    expect(result.ok).toBe(false);
    expect(result.hasNumber).toBe(false);
    expect(result.hasLetter).toBe(true);
  });

  it("rejects an all-digit password (missing a letter)", () => {
    const result = checkPassword("12345678");
    expect(result.ok).toBe(false);
    expect(result.hasLetter).toBe(false);
    expect(result.hasNumber).toBe(true);
  });

  it("treats exactly PASSWORD_MIN_LENGTH chars as long enough", () => {
    const pw = "a".repeat(PASSWORD_MIN_LENGTH - 1) + "1";
    expect(pw.length).toBe(PASSWORD_MIN_LENGTH);
    expect(checkPassword(pw).hasLength).toBe(true);
  });
});
