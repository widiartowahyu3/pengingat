import { describe, expect, it } from "vitest";
import { ACTIVE_END_MINUTES, ACTIVE_START_MINUTES, isWithinActiveHours } from "../lib/reminder";
import { dayEndWibSchema, studyStartWibSchema } from "../lib/validation";

describe("konstanta jam aktif bersama", () => {
  it("07:55 dan 16:30 dalam menit", () => {
    expect(ACTIVE_START_MINUTES).toBe(7 * 60 + 55);
    expect(ACTIVE_END_MINUTES).toBe(16 * 60 + 30);
  });

  it("batas tepi inklusif-eksklusif [07:55, 16:30)", () => {
    expect(isWithinActiveHours(new Date("2026-10-12T00:54:00.000Z"))).toBe(false); // 07:54
    expect(isWithinActiveHours(new Date("2026-10-12T00:55:00.000Z"))).toBe(true); // 07:55
    expect(isWithinActiveHours(new Date("2026-10-12T09:29:00.000Z"))).toBe(true); // 16:29
    expect(isWithinActiveHours(new Date("2026-10-12T09:30:00.000Z"))).toBe(false); // 16:30
    expect(isWithinActiveHours(new Date("2026-10-12T16:00:00.000Z"))).toBe(false); // 23:00
  });
});

describe("validasi setting memakai konstanta yang sama", () => {
  it("studyStartWib: 07:54 ditolak, 07:55 diterima", () => {
    expect(studyStartWibSchema.safeParse("07:54").success).toBe(false);
    expect(studyStartWibSchema.safeParse("07:55").success).toBe(true);
    expect(studyStartWibSchema.safeParse("08:00").success).toBe(true);
  });

  it("dayEndWib: +20 mnt harus <= 16:30", () => {
    expect(dayEndWibSchema.safeParse("16:10").success).toBe(true); // 16:30 pas
    expect(dayEndWibSchema.safeParse("16:11").success).toBe(false);
    expect(dayEndWibSchema.safeParse("16:00").success).toBe(true);
  });

  it("format salah ditolak dengan pesan jelas", () => {
    const r = studyStartWibSchema.safeParse("pagi");
    expect(r.success).toBe(false);
  });
});
