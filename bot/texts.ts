import type { TickStats } from "../lib/reminder";

// Template pesan bot (WIB). Tidak memuat koordinat, token, atau catatan.

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

export function progressLine(stats: TickStats): string {
  return (
    `Dicoding ${stats.minutesDicoding}/${stats.targetDicoding} mnt ` +
    `(${pct(stats.minutesDicoding, stats.targetDicoding)}%), ` +
    `ClinForm ${stats.minutesClinForm}/${stats.targetClinForm} mnt ` +
    `(${pct(stats.minutesClinForm, stats.targetClinForm)}%). ` +
    `Streak ${stats.streakDays} hari.`
  );
}

export interface JadwalRow {
  label: string;
  hm: string;
}

export function jadwalMessage(
  locationLabel: string,
  rows: JadwalRow[],
  dhuhrHm: string,
  ashrHm: string,
): string {
  const lines = rows.map((r) => `${r.hm} ${r.label}`);
  return [
    `Jadwal hari ini (${locationLabel}, WIB):`,
    ...lines,
    `Dzuhur ${dhuhrHm}, Ashar ${ashrHm}.`,
  ].join("\n");
}

export function lokasiListMessage(
  activeLabel: string,
  presets: Array<{ key: string; name: string }>,
): string {
  const lines = presets.map((p) => `/lokasi ${p.key} — ${p.name}`);
  return [`Lokasi aktif: ${activeLabel}.`, "Preset:", ...lines].join("\n");
}
