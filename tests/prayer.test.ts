import { describe, expect, it } from "vitest";
import { getDhuhrAsr } from "../lib/prayer";
import { formatWibHm } from "../lib/time";

const YOGYA = { lat: -7.80139, lon: 110.36444 };

// Adhan membaca komponen LOKAL Date sistem (terbukti di riset Tahap A).
// Pustaka kita memaksa UTC di dalam, jadi hasil harus identik di zona apa pun.
describe("getDhuhrAsr kebal zona sistem", () => {
  const zones = ["UTC", "Asia/Jakarta", "Pacific/Kiritimati", "America/New_York"];
  for (const zone of zones) {
    it(`identik di TZ=${zone}`, () => {
      const prev = process.env.TZ;
      process.env.TZ = zone;
      try {
        const t = getDhuhrAsr("2026-10-11", YOGYA.lat, YOGYA.lon);
        // Nilai pasti (adhan 4.4.6, pin di package.json). Bila gagal setelah
        // bump versi, anggap sinyal kalibrasi ulang, bukan sekadar update angka.
        expect(t.dhuhr.toISOString()).toBe("2026-10-11T04:27:00.000Z"); // 11:27 WIB
        expect(t.asr.toISOString()).toBe("2026-10-11T07:29:00.000Z"); // 14:29 WIB
      } finally {
        if (prev === undefined) delete process.env.TZ;
        else process.env.TZ = prev;
      }
    });
  }

  it("tanggal salah melempar error generik", () => {
    expect(() => getDhuhrAsr("11-10-2026", YOGYA.lat, YOGYA.lon)).toThrow(/tanggal tidak valid/);
  });

  it("urutan wajar: Dzuhur < Ashar, dalam rentang WIB masuk akal", () => {
    const t = getDhuhrAsr("2026-07-15", YOGYA.lat, YOGYA.lon);
    expect(t.dhuhr.getTime()).toBeLessThan(t.asr.getTime());
    expect(formatWibHm(t.dhuhr) >= "11:00" && formatWibHm(t.dhuhr) <= "12:30").toBe(true);
    expect(formatWibHm(t.asr) >= "14:00" && formatWibHm(t.asr) <= "16:00").toBe(true);
  });
});
