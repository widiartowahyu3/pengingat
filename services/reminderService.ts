import { db } from "../lib/db";
import { env } from "../lib/env";
import { resolveTickLocation, runReminderTick, type TickStats } from "../lib/reminder";
import { wibDateKey, combineWibDateTime, addMinutes } from "../lib/time";
import { markEventFailed, markEventSent, tryClaimEvent } from "../repositories/reminderRepo";

export interface TickSender {
  sendMessage(text: string): Promise<void>;
}

export interface TickSummary {
  due: number;
  sent: number;
  failed: number;
  skippedInactiveDay: boolean;
}

interface DayStats {
  minutesDicoding: number;
  minutesClinForm: number;
}

/** Menit per jalur untuk tanggal WIB (rentang UTC dihitung eksplisit). */
async function statsForDate(userId: string, localDate: string): Promise<DayStats> {
  const start = combineWibDateTime(localDate, { h: 0, m: 0 });
  const end = addMinutes(start, 24 * 60);
  const rows = await db.studySession.groupBy({
    by: ["track"],
    where: { userId, startedAt: { gte: start, lt: end } },
    _sum: { durationMin: true },
  });
  let minutesDicoding = 0;
  let minutesClinForm = 0;
  for (const r of rows) {
    if (r.track === "DICODING") minutesDicoding = r._sum.durationMin ?? 0;
    if (r.track === "CLINFORM") minutesClinForm = r._sum.durationMin ?? 0;
  }
  return { minutesDicoding, minutesClinForm };
}

/** Progres hari ini untuk balasan bot (/hari_ini, /selesai, /jadwal). */
export async function todayProgress(
  userId: string,
  now: Date,
): Promise<TickStats & { localDate: string }> {
  const localDate = wibDateKey(now);
  const [day, targets, streak] = await Promise.all([
    statsForDate(userId, localDate),
    db.dailyTarget.findMany({ where: { userId } }),
    streakUpTo(userId, now),
  ]);
  const targetOf = (track: "DICODING" | "CLINFORM"): number =>
    targets.find((t) => t.track === track)?.minutesPerDay ?? 0;
  return {
    localDate,
    minutesDicoding: day.minutesDicoding,
    minutesClinForm: day.minutesClinForm,
    targetDicoding: targetOf("DICODING"),
    targetClinForm: targetOf("CLINFORM"),
    streakDays: streak,
  };
}
/** Streak = hari WIB beruntun dengan ≥1 sesi, dihitung mundur dari hari ini. */
export async function streakUpTo(userId: string, now: Date): Promise<number> {
  const rows = await db.studySession.findMany({
    where: { userId },
    select: { startedAt: true },
    orderBy: { startedAt: "desc" },
    take: 500,
  });
  const days = new Set(rows.map((r) => wibDateKey(r.startedAt)));
  let streak = 0;
  let cursor = new Date(now.getTime());
  if (!days.has(wibDateKey(cursor))) {
    cursor = addMinutes(cursor, -24 * 60); // hari ini kosong -> mulai dari kemarin
  }
  while (days.has(wibDateKey(cursor))) {
    streak += 1;
    cursor = addMinutes(cursor, -24 * 60);
  }
  return streak;
}

/**
 * Satu tick pengingat: hitung event jatuh tempo (murni), klaim atomik,
 * kirim, tandai. Dipakai penjadwal lokal dan endpoint cron. Idempoten:
 * tick ganda hanya menghasilkan satu pesan per event.
 */
export async function processTick(now: Date, sender: TickSender): Promise<TickSummary> {
  const user = await db.user.findFirst({ select: { id: true } });
  if (user === null) {
    return { due: 0, sent: 0, failed: 0, skippedInactiveDay: false };
  }
  const setting = await db.userSetting.findUnique({ where: { userId: user.id } });
  if (setting === null) {
    return { due: 0, sent: 0, failed: 0, skippedInactiveDay: false };
  }

  const localDate = wibDateKey(now);
  const [day, targets, active, streak, claims] = await Promise.all([
    statsForDate(user.id, localDate),
    db.dailyTarget.findMany({ where: { userId: user.id } }),
    db.activeSession.findUnique({ where: { userId: user.id } }),
    streakUpTo(user.id, now),
    db.reminderEvent.findMany({
      where: { userId: user.id, localDate },
      select: { eventKey: true, status: true, claimedAt: true },
    }),
  ]);

  const targetOf = (track: "DICODING" | "CLINFORM"): number =>
    targets.find((t) => t.track === track)?.minutesPerDay ?? 0;
  const stats: TickStats = {
    minutesDicoding: day.minutesDicoding,
    minutesClinForm: day.minutesClinForm,
    targetDicoding: targetOf("DICODING"),
    targetClinForm: targetOf("CLINFORM"),
    streakDays: streak,
  };

  const location = resolveTickLocation(
    {
      locationKey: setting.locationKey,
      locationLat: setting.locationLat,
      locationLon: setting.locationLon,
    },
    env.LOCATION_DEFAULT_KEY,
  );

  const due = runReminderTick({
    now,
    settings: {
      studyStartWib: setting.studyStartWib,
      dayEndWib: setting.dayEndWib,
      prayerBreakMin: setting.prayerBreakMin,
      fridayPrayerBreakMin: setting.fridayPrayerBreakMin,
      activeDays: setting.activeDays,
      locationKey: setting.locationKey,
      locationLat: setting.locationLat,
      locationLon: setting.locationLon,
    },
    location,
    hasActiveSession: active !== null,
    activeTrack: active?.track ?? null,
    stats,
    existing: Object.fromEntries(
      claims.map((c) => [c.eventKey, { status: c.status, claimedAt: c.claimedAt }]),
    ),
  });

  let sent = 0;
  let failed = 0;
  for (const event of due) {
    const claim = await tryClaimEvent(user.id, event.localDate, event.eventKey, now);
    if (claim.outcome !== "claimed" || claim.id === null) continue;
    try {
      await sender.sendMessage(event.message);
      await markEventSent(claim.id);
      sent += 1;
    } catch {
      await markEventFailed(claim.id);
      failed += 1;
    }
  }
  return { due: due.length, sent, failed, skippedInactiveDay: due.length === 0 };
}
