// Helper zona waktu. Semua perhitungan memakai offset WIB tetap (+7) lewat
// aritmetika epoch, TIDAK PERNAH memakai komponen lokal Date (getHours,
// toLocaleString tanpa timeZone, dsb) agar hasil identik di server mana pun
// (UTC di Vercel, WIB di WSL, atau zona lain).

export const WIB_OFFSET_MINUTES = 7 * 60;
export const WIB_ZONE = "Asia/Jakarta";

const DAY_MS = 24 * 60 * 60 * 1000;

function wibEpoch(now: Date): number {
  return now.getTime() + WIB_OFFSET_MINUTES * 60 * 1000;
}

/** Tanggal kalender WIB "YYYY-MM-DD" dari sebuah instant. */
export function wibDateKey(now: Date): string {
  return new Date(wibEpoch(now)).toISOString().slice(0, 10);
}

/** Hari dalam minggu menurut WIB: 0=Minggu .. 6=Sabtu. */
export function wibWeekday(now: Date): number {
  const days = Math.floor(wibEpoch(now) / DAY_MS);
  // 1970-01-01 adalah Kamis (4) dalam konvensi Minggu=0.
  return (((days + 4) % 7) + 7) % 7;
}

/** Menit sejak 00:00 WIB (0..1439). */
export function wibMinutes(now: Date): number {
  return Math.floor((wibEpoch(now) % DAY_MS) / 60000);
}

/** "HH:MM" WIB dari sebuah instant. */
export function formatWibHm(instant: Date): string {
  const total = Math.floor((wibEpoch(instant) % DAY_MS) / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface HhMm {
  h: number;
  m: number;
}

/** Parse "HH:MM" 24 jam. null bila format salah (validasi Zod ada di input). */
export function parseHhMm(s: string): HhMm | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    return null;
  }
  return { h: Number(match[1]), m: Number(match[2]) };
}

/** Instant UTC dari tanggal WIB + jam "HH:MM" WIB. */
export function combineWibDateTime(dateKey: string, hhmm: HhMm): Date {
  const parts = dateKey.split("-").map(Number);
  const y = parts[0] ?? 0;
  const mo = parts[1] ?? 0;
  const d = parts[2] ?? 0;
  return new Date(Date.UTC(y, mo - 1, d, hhmm.h - 7, hhmm.m, 0, 0));
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60000);
}

/**
 * Jalankan fungsi sinkron dengan TZ=UTC (dipulihkan di finally). Kenapa:
 * library `adhan` membaca komponen LOKAL Date sistem, jadi hasilnya bisa
 * geser sehari di server berzona ekstrem (terbukti: input sama memberi
 * 11 Okt di TZ=UTC tapi 12 Okt di TZ=+14). Node single-threaded dan adhan
 * sinkron, jadi ini aman.
 */
export function withForcedUtc<T>(fn: () => T): T {
  const prev = process.env.TZ;
  process.env.TZ = "UTC";
  try {
    return fn();
  } finally {
    if (prev === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = prev;
    }
  }
}
