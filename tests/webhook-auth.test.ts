import { describe, expect, it } from "vitest";
import { isAllowedChat, secretsEqual } from "../bot/security";

describe("secretsEqual (constant-time)", () => {
  it("sama -> true, beda -> false, panjang beda -> false", () => {
    expect(secretsEqual("rahasia-sama-16", "rahasia-sama-16")).toBe(true);
    expect(secretsEqual("rahasia-sama-16", "rahasia-beda-16")).toBe(false);
    expect(secretsEqual("pendek", "jauh-lebih-panjang")).toBe(false);
    expect(secretsEqual("", "")).toBe(true);
  });
});

describe("isAllowedChat", () => {
  it("hanya allowlist yang lolos", () => {
    expect(isAllowedChat(111, [111, 222])).toBe(true);
    expect(isAllowedChat(999, [111, 222])).toBe(false);
    expect(isAllowedChat(111, [])).toBe(false);
  });
});
