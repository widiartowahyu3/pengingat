import { CalculationMethod, Coordinates, PrayerTimes } from "adhan";
import { addMinutes, withForcedUtc } from "./time";

export interface PrayerDay {
  dhuhr: Date;
  asr: Date;
}

// Penyesuaian kalibrasi (menit) terhadap hitungan adhan metode Singapore.
// Nol sampai ada data pembanding Kemenag dari user (lihat tabel kalibrasi di
// laporan Tahap A). Hanya Dzuhur dan Ashar yang dipakai pengingat, jadi hanya
// dua itu yang dikalibrasi.
export const PRAYER_CALIBRATION_MINUTES = {
  dhuhr: 0,
  asr: 0,
} as const;

function parseDateKey(dateKey: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (
    match === null ||
    match[1] === undefined ||
    match[2] === undefined ||
    match[3] === undefined
  ) {
    return null;
  }
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/**
 * Waktu Dzuhur & Ashar (instant UTC) untuk tanggal kalender WIB + koordinat.
 * Metode Singapore (Subuh 20°, Isya 18° = kriteria Kemenag) ditetapkan di kode.
 * Input tanggal dibangun dari kalender WIB secara eksplisit di dalam
 * withForcedUtc, jadi zona sistem tidak memengaruhi hasil.
 */
export function getDhuhrAsr(dateKey: string, lat: number, lon: number): PrayerDay {
  const parts = parseDateKey(dateKey);
  if (parts === null) {
    throw new Error("tanggal tidak valid (harap YYYY-MM-DD)");
  }
  return withForcedUtc(() => {
    const coords = new Coordinates(lat, lon);
    const params = CalculationMethod.Singapore();
    const input = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 0, 0, 0));
    const times = new PrayerTimes(coords, input, params);
    return {
      dhuhr: addMinutes(times.dhuhr, PRAYER_CALIBRATION_MINUTES.dhuhr),
      asr: addMinutes(times.asr, PRAYER_CALIBRATION_MINUTES.asr),
    };
  });
}
