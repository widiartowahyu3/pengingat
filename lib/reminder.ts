import { getPreset, LOCATION_PRESETS } from "./locations";
import { getDhuhrAsr } from "./prayer";
import {
  addMinutes,
  combineWibDateTime,
  formatWibHm,
  parseHhMm,
  wibDateKey,
  wibMinutes,
  wibWeekday,
} from "./time";

// Satu fungsi bersama untuk penjadwal lokal (bot polling) dan endpoint cron.
// MURNI: tanpa I/O. Semua data di-inject; pemanggil yang klaim ke DB lalu kirim.

export const REMINDER_WINDOW_MINUTES = 20;
export const CLAIM_RETRY_AFTER_MINUTES = 2;

// Gerbang hemat CU Neon: di luar jam ini tick keluar sebelum query DB apa pun.
// Satu sumber kebenaran — dipakai gerbang cron DAN validasi setting.
export const ACTIVE_START_MINUTES = 7 * 60 + 55; // 07:55 WIB
export const ACTIVE_END_MINUTES = 16 * 60 + 30; // 16:30 WIB

export type ReminderEventKey =
  "STUDY_START" | "DZUHUR_BREAK" | "DZUHUR_RESUME" | "ASHAR_BREAK" | "ASHAR_RESUME" | "DAY_END";

export type ClaimStatus = "CLAIMED" | "SENT" | "FAILED";

/** true bila instant berada di jam aktif [07:55, 16:30) WIB. */
export function isWithinActiveHours(now: Date): boolean {
  const m = wibMinutes(now);
  return m >= ACTIVE_START_MINUTES && m < ACTIVE_END_MINUTES;
}

export interface TickSettings {
  studyStartWib: string;
  dayEndWib: string;
  prayerBreakMin: number;
  fridayPrayerBreakMin: number;
  activeDays: number[];
  locationKey: string | null;
  locationLat: number | null;
  locationLon: number | null;
}

export interface TickLocation {
  lat: number;
  lon: number;
  /** "Yogyakarta" untuk preset, "lokasi kiriman" untuk koordinat manual. */
  label: string;
}

export interface TickStats {
  minutesDicoding: number;
  minutesClinForm: number;
  targetDicoding: number;
  targetClinForm: number;
  streakDays: number;
}

export interface ExistingClaim {
  status: ClaimStatus;
  claimedAt: Date;
}

export interface TickInput {
  now: Date;
  settings: TickSettings;
  location: TickLocation;
  hasActiveSession: boolean;
  activeTrack: string | null;
  stats: TickStats;
  existing: Partial<Record<ReminderEventKey, ExistingClaim>>;
}

export interface DueEvent {
  eventKey: ReminderEventKey;
  localDate: string;
  /** Waktu event (instant UTC). Jatuh tempo di [dueAt, dueAt+20 mnt). */
  dueAt: Date;
  message: string;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

/** Selesaikan lokasi dari setting; jatuh ke preset default bila tak valid. */
export function resolveTickLocation(
  settings: Pick<TickSettings, "locationKey" | "locationLat" | "locationLon">,
  defaultKey: string,
): TickLocation {
  if (settings.locationKey !== null) {
    const preset = getPreset(settings.locationKey);
    if (preset !== null) {
      return { lat: preset.lat, lon: preset.lon, label: preset.name };
    }
  }
  if (
    typeof settings.locationLat === "number" &&
    typeof settings.locationLon === "number" &&
    Number.isFinite(settings.locationLat) &&
    Number.isFinite(settings.locationLon)
  ) {
    return { lat: settings.locationLat, lon: settings.locationLon, label: "lokasi kiriman" };
  }
  const fallback = getPreset(defaultKey) ?? LOCATION_PRESETS.yogyakarta;
  return { lat: fallback.lat, lon: fallback.lon, label: fallback.name };
}

export interface PlanItem {
  key: ReminderEventKey;
  dueAt: Date;
  message: string;
}

export interface DayPlanInput {
  localDate: string;
  weekday: number;
  settings: TickSettings;
  location: TickLocation;
  hasActiveSession: boolean;
  activeTrack: string | null;
  stats: TickStats;
}

/**
 * Rencana sehari penuh (baik yang dilewati aturan maupun tidak — RESUME yang
 * dilewati dikembalikan sebagai null). Dipakai tick dan /jadwal agar sama.
 * null bila hari non-aktif atau setting jam rusak.
 */
export function buildDayPlan(args: DayPlanInput): Array<PlanItem | null> | null {
  const { localDate, weekday, settings, location, hasActiveSession, activeTrack, stats } = args;
  if (!settings.activeDays.includes(weekday)) {
    return null;
  }
  const start = parseHhMm(settings.studyStartWib);
  const end = parseHhMm(settings.dayEndWib);
  if (start === null || end === null) {
    return null;
  }
  const dayEnd = combineWibDateTime(localDate, end);

  const prayer = getDhuhrAsr(localDate, location.lat, location.lon);
  const isFriday = weekday === 5;
  const breakMin = isFriday ? settings.fridayPrayerBreakMin : settings.prayerBreakMin;

  const dD = stats.minutesDicoding;
  const dC = stats.minutesClinForm;
  const progress = `Dicoding ${dD}/${stats.targetDicoding} mnt (${pct(dD, stats.targetDicoding)}%), ClinForm ${dC}/${stats.targetClinForm} mnt (${pct(dC, stats.targetClinForm)}%). Streak ${stats.streakDays} hari.`;

  const breakMsg = (name: string, resumeHm: string): string =>
    hasActiveSession
      ? `Masuk waktu ${name}. Selesaikan sesi ${activeTrack ?? ""} yang berjalan, lalu istirahat ${breakMin} menit (lanjut ${resumeHm} WIB).`
      : `Masuk waktu ${name}. Istirahat ${breakMin} menit, lanjut lagi ${resumeHm} WIB. ${progress}`;

  return [
    {
      key: "STUDY_START",
      dueAt: combineWibDateTime(localDate, start),
      message: `Selamat pagi, waktunya belajar. Target hari ini: ${progress}`,
    },
    {
      key: "DZUHUR_BREAK",
      dueAt: prayer.dhuhr,
      message: breakMsg("Dzuhur", formatWibHm(addMinutes(prayer.dhuhr, breakMin))),
    },
    resumeCandidate("DZUHUR_RESUME", addMinutes(prayer.dhuhr, breakMin), dayEnd),
    {
      key: "ASHAR_BREAK",
      dueAt: prayer.asr,
      message: breakMsg("Ashar", formatWibHm(addMinutes(prayer.asr, breakMin))),
    },
    resumeCandidate("ASHAR_RESUME", addMinutes(prayer.asr, breakMin), dayEnd),
    {
      key: "DAY_END",
      dueAt: dayEnd,
      message: `Ringkasan hari ini: ${progress}`,
    },
  ];
}

export function runReminderTick(input: TickInput): DueEvent[] {
  const { now, settings, location, hasActiveSession, activeTrack, stats, existing } = input;
  const localDate = wibDateKey(now);
  const weekday = wibWeekday(now);

  const plan = buildDayPlan({
    localDate,
    weekday,
    settings,
    location,
    hasActiveSession,
    activeTrack,
    stats,
  });
  if (plan === null) return [];

  const out: DueEvent[] = [];
  for (const c of plan) {
    if (c === null) continue;
    const windowEnd = addMinutes(c.dueAt, REMINDER_WINDOW_MINUTES);
    if (now < c.dueAt || now >= windowEnd) continue; // basi atau belum saatnya
    if (existing[c.key]?.status === "SENT") continue;
    out.push({ eventKey: c.key, localDate, dueAt: c.dueAt, message: c.message });
  }
  return out;
}

/**
 * RESUME dilewati bila sisa waktu ke dayEnd kurang dari 20 menit
 * (tak cukup untuk satu sesi fokus yang berarti).
 */
function resumeCandidate(
  key: "DZUHUR_RESUME" | "ASHAR_RESUME",
  resumeAt: Date,
  dayEnd: Date,
): { key: "DZUHUR_RESUME" | "ASHAR_RESUME"; dueAt: Date; message: string } | null {
  if (dayEnd.getTime() - resumeAt.getTime() < REMINDER_WINDOW_MINUTES * 60000) {
    return null;
  }
  return {
    key,
    dueAt: resumeAt,
    message: `Istirahat selesai, lanjut belajar sampai ${formatWibHm(dayEnd)} WIB.`,
  };
}
