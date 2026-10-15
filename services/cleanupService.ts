import { db } from "../lib/db";
import { addMinutes, wibDateKey } from "../lib/time";

const CLEANUP_KEY = "cleanup";
const RETENTION_DAYS = 7;
const ROW_LIMIT = 500;

export interface CleanupResult {
  ran: boolean;
  deletedReminderEvents: number;
  deletedLoginAttempts: number;
  deletedTelegramUpdates: number;
}

/**
 * Hapus baris >7 hari, maksimal sekali per hari kalender WIB, maksimal
 * ROW_LIMIT baris per tabel per eksekusi. Dijalankan di ekor tick cron
 * (bukan tiap tick) agar tidak melewati batas waktu fungsi.
 */
export async function runCleanup(now: Date): Promise<CleanupResult> {
  const today = wibDateKey(now);
  const state = await db.maintenanceState.findUnique({ where: { key: CLEANUP_KEY } });
  if (state !== null && wibDateKey(state.lastRunAt) === today) {
    return {
      ran: false,
      deletedReminderEvents: 0,
      deletedLoginAttempts: 0,
      deletedTelegramUpdates: 0,
    };
  }

  const cutoff = addMinutes(now, -RETENTION_DAYS * 24 * 60);

  const reminderIds = await db.reminderEvent.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true },
    take: ROW_LIMIT,
  });
  const attemptIds = await db.loginAttempt.findMany({
    where: { attemptedAt: { lt: cutoff } },
    select: { id: true },
    take: ROW_LIMIT,
  });
  const updateIds = await db.telegramProcessedUpdate.findMany({
    where: { receivedAt: { lt: cutoff } },
    select: { updateId: true },
    take: ROW_LIMIT,
  });

  const [reminders, attempts, updates] = await Promise.all([
    db.reminderEvent.deleteMany({ where: { id: { in: reminderIds.map((r) => r.id) } } }),
    db.loginAttempt.deleteMany({ where: { id: { in: attemptIds.map((r) => r.id) } } }),
    db.telegramProcessedUpdate.deleteMany({
      where: { updateId: { in: updateIds.map((r) => r.updateId) } },
    }),
  ]);

  await db.maintenanceState.upsert({
    where: { key: CLEANUP_KEY },
    create: { key: CLEANUP_KEY, lastRunAt: now },
    update: { lastRunAt: now },
  });

  return {
    ran: true,
    deletedReminderEvents: reminders.count,
    deletedLoginAttempts: attempts.count,
    deletedTelegramUpdates: updates.count,
  };
}
