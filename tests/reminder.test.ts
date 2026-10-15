import { describe, expect, it } from "vitest";
import { getDhuhrAsr } from "../lib/prayer";
import {
  buildDayPlan,
  runReminderTick,
  type TickInput,
  type TickLocation,
  type TickSettings,
  type TickStats,
} from "../lib/reminder";

const SETTINGS: TickSettings = {
  studyStartWib: "08:00",
  dayEndWib: "16:00",
  prayerBreakMin: 30,
  fridayPrayerBreakMin: 60,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
  locationKey: "yogyakarta",
  locationLat: null,
  locationLon: null,
};

const LOC: TickLocation = { lat: -7.80139, lon: 110.36444, label: "Yogyakarta" };

const STATS: TickStats = {
  minutesDicoding: 10,
  minutesClinForm: 20,
  targetDicoding: 60,
  targetClinForm: 60,
  streakDays: 3,
};

function input(nowIso: string, over: Partial<TickInput> = {}): TickInput {
  return {
    now: new Date(nowIso),
    settings: { ...SETTINGS },
    location: LOC,
    hasActiveSession: false,
    activeTrack: null,
    stats: STATS,
    existing: {},
    ...over,
  };
}

describe("runReminderTick", () => {
  it("STUDY_START jatuh tempo di [08:00, 08:20) WIB", () => {
    // Senin 2026-10-12 08:05 WIB.
    const due = runReminderTick(input("2026-10-12T01:05:00.000Z"));
    expect(due.map((d) => d.eventKey)).toEqual(["STUDY_START"]);
    expect(due[0]?.localDate).toBe("2026-10-12");
    expect(due[0]?.message).toContain("Dicoding 10/60");
  });

  it("sebelum dan sesudah jendela tidak ada event", () => {
    expect(runReminderTick(input("2026-10-12T00:59:00.000Z"))).toEqual([]);
    expect(runReminderTick(input("2026-10-12T01:20:00.000Z"))).toEqual([]);
  });

  it("DZUHUR_BREAK jatuh tempo 5 menit setelah Dzuhur", () => {
    const prayer = getDhuhrAsr("2026-10-12", LOC.lat, LOC.lon);
    const due = runReminderTick(input(new Date(prayer.dhuhr.getTime() + 5 * 60000).toISOString()));
    expect(due.map((d) => d.eventKey)).toEqual(["DZUHUR_BREAK"]);
  });

  it("event basi dilewati (25 menit setelah Dzuhur)", () => {
    const prayer = getDhuhrAsr("2026-10-12", LOC.lat, LOC.lon);
    expect(
      runReminderTick(input(new Date(prayer.dhuhr.getTime() + 25 * 60000).toISOString())),
    ).toEqual([]);
  });

  it("SENT yang sudah ada tidak dikirim ulang", () => {
    const due = runReminderTick(
      input("2026-10-12T01:05:00.000Z", {
        existing: { STUDY_START: { status: "SENT", claimedAt: new Date() } },
      }),
    );
    expect(due).toEqual([]);
  });

  it("hari non-aktif tidak ada event", () => {
    const due = runReminderTick(
      input("2026-10-12T01:05:00.000Z", {
        settings: { ...SETTINGS, activeDays: [0] }, // Senin(1) non-aktif
      }),
    );
    expect(due).toEqual([]);
  });

  it("Jumat memakai istirahat 60 menit untuk Dzuhur", () => {
    // Jumat 2026-10-16.
    const plan = buildDayPlan({
      localDate: "2026-10-16",
      weekday: 5,
      settings: SETTINGS,
      location: LOC,
      hasActiveSession: false,
      activeTrack: null,
      stats: STATS,
    });
    expect(plan).not.toBeNull();
    const items = (plan ?? []).filter((p): p is NonNullable<typeof p> => p !== null);
    const brk = items.find((p) => p.key === "DZUHUR_BREAK");
    const resume = items.find((p) => p.key === "DZUHUR_RESUME");
    if (brk === undefined || resume === undefined) {
      throw new Error("rencana Jumat tidak lengkap");
    }
    expect(resume.dueAt.getTime() - brk.dueAt.getTime()).toBe(60 * 60000);
    expect(brk.message).toContain("60 menit");
  });

  it("RESUME dilewati bila sisa ke dayEnd <20 menit", () => {
    // Ashar ~14:29 + 30 = ~14:59; dayEnd 15:10 -> selisih ~11 menit.
    const plan = buildDayPlan({
      localDate: "2026-10-12",
      weekday: 1,
      settings: { ...SETTINGS, dayEndWib: "15:10" },
      location: LOC,
      hasActiveSession: false,
      activeTrack: null,
      stats: STATS,
    });
    expect(plan).not.toBeNull();
    const keys = (plan ?? [])
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p) => p.key);
    expect(keys).not.toContain("ASHAR_RESUME");
    expect(keys).toContain("DZUHUR_RESUME");
  });

  it("BREAK saat sesi aktif meminta selesaikan sesi, tanpa menutup", () => {
    const prayer = getDhuhrAsr("2026-10-12", LOC.lat, LOC.lon);
    const due = runReminderTick(
      input(new Date(prayer.dhuhr.getTime() + 5 * 60000).toISOString(), {
        hasActiveSession: true,
        activeTrack: "DICODING",
      }),
    );
    expect(due).toHaveLength(1);
    expect(due[0]?.message).toContain("Selesaikan sesi DICODING");
    expect(due[0]?.message).not.toContain("ditutup");
  });

  it("BREAK tanpa sesi aktif berisi ajakan istirahat + progres", () => {
    const prayer = getDhuhrAsr("2026-10-12", LOC.lat, LOC.lon);
    const due = runReminderTick(input(new Date(prayer.dhuhr.getTime() + 5 * 60000).toISOString()));
    expect(due[0]?.message).toContain("Istirahat 30 menit");
    expect(due[0]?.message).toContain("Streak 3 hari");
  });

  it("DAY_END berisi ringkasan", () => {
    // 2026-10-12 16:05 WIB.
    const due = runReminderTick(input("2026-10-12T09:05:00.000Z"));
    expect(due.map((d) => d.eventKey)).toEqual(["DAY_END"]);
    expect(due[0]?.message).toContain("Ringkasan hari ini");
  });

  it("00:10 WIB memakai tanggal lokal yang benar (tidak ada event tengah malam)", () => {
    // 2026-10-10 17:10 UTC = 2026-10-11 00:10 WIB (Minggu).
    expect(runReminderTick(input("2026-10-10T17:10:00.000Z"))).toEqual([]);
  });
});
