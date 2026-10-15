import { afterEach, describe, expect, it } from "vitest";
import {
  combineWibDateTime,
  formatWibHm,
  parseHhMm,
  wibDateKey,
  wibMinutes,
  wibWeekday,
} from "../lib/time";

// Semua asersi di bawah dijalankan dua kali: TZ=UTC (Vercel) dan
// TZ=Pacific/Kiritimati (+14, kasus ekstrem). Hasil harus identik.

const ZONES = ["UTC", "Pacific/Kiritimati", "Asia/Jakarta"];

describe.each(ZONES)("wib helpers (%s)", (zone) => {
  const prev = process.env.TZ;
  process.env.TZ = zone;
  afterEach(() => {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  });

  it("wibDateKey: 00:10 WIB = tanggal lokal yang benar", () => {
    // 2026-10-10 17:10 UTC = 2026-10-11 00:10 WIB.
    expect(wibDateKey(new Date("2026-10-10T17:10:00.000Z"))).toBe("2026-10-11");
  });

  it("wibDateKey batas hari: 23:55 vs 00:05 beda tanggal", () => {
    expect(wibDateKey(new Date("2026-10-11T16:55:00.000Z"))).toBe("2026-10-11");
    expect(wibDateKey(new Date("2026-10-11T17:05:00.000Z"))).toBe("2026-10-12");
  });

  it("wibWeekday: 2026-10-11 Minggu, 2026-10-12 Senin", () => {
    expect(wibWeekday(new Date("2026-10-11T05:00:00.000Z"))).toBe(0);
    expect(wibWeekday(new Date("2026-10-12T01:00:00.000Z"))).toBe(1);
  });

  it("wibMinutes + formatWibHm konsisten", () => {
    const d = new Date("2026-10-12T01:05:00.000Z"); // 08:05 WIB
    expect(wibMinutes(d)).toBe(8 * 60 + 5);
    expect(formatWibHm(d)).toBe("08:05");
  });

  it("parseHhMm menerima benar menolak salah", () => {
    expect(parseHhMm("08:00")).toEqual({ h: 8, m: 0 });
    expect(parseHhMm("16:00")).toEqual({ h: 16, m: 0 });
    expect(parseHhMm("24:00")).toBeNull();
    expect(parseHhMm("8:00")).toBeNull();
    expect(parseHhMm("ab:cd")).toBeNull();
  });

  it("combineWibDateTime: 08:00 WIB = 01:00 UTC", () => {
    expect(combineWibDateTime("2026-10-12", { h: 8, m: 0 }).toISOString()).toBe(
      "2026-10-12T01:00:00.000Z",
    );
  });
});
