// Dry-run pengingat: menjalankan runReminderTick TANPA mengirim ke Telegram
// dan TANPA menulis ke DB (klaim tidak dibuat, status tidak diubah).
// Pakai: npm run reminder:simulate -- --at "2026-10-12T08:05:00+07:00"
// Output: daftar event (eventKey, waktu event WIB, jatuh tempo atau tidak).
// Tidak mencetak token, chat ID, user ID, atau koordinat.
import "dotenv/config";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { getDhuhrAsr } from "../lib/prayer";
import {
  buildDayPlan,
  REMINDER_WINDOW_MINUTES,
  resolveTickLocation,
  runReminderTick,
} from "../lib/reminder";
import { addMinutes, formatWibHm, wibDateKey, wibWeekday } from "../lib/time";
import { todayProgress } from "../services/reminderService";

void env; // fail-fast bila env kurang

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseAt(): Date {
  const idx = process.argv.indexOf("--at");
  const raw = idx >= 0 ? process.argv[idx + 1] : undefined;
  if (raw === undefined || raw === "") {
    fail('pakai: npm run reminder:simulate -- --at "2026-10-12T08:05:00+07:00"');
  }
  // Wajib offset +07:00 eksplisit agar tidak ambigu dengan zona server.
  if (!/\+07:00$/.test(raw)) {
    fail("--at harus ISO dengan offset +07:00, mis. 2026-10-12T08:05:00+07:00");
  }
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) fail("--at bukan tanggal valid.");
  return at;
}

async function main(): Promise<void> {
  const at = parseAt();
  const localDate = wibDateKey(at);
  const weekday = wibWeekday(at);

  const user = await db.user.findFirst({ select: { id: true } });
  const usingDefaults = user === null;
  const setting =
    user === null ? null : await db.userSetting.findUnique({ where: { userId: user.id } });
  const settings = {
    studyStartWib: setting?.studyStartWib ?? "08:00",
    dayEndWib: setting?.dayEndWib ?? "16:00",
    prayerBreakMin: setting?.prayerBreakMin ?? 30,
    fridayPrayerBreakMin: setting?.fridayPrayerBreakMin ?? 60,
    activeDays: setting?.activeDays ?? [0, 1, 2, 3, 4, 5, 6],
    locationKey: setting?.locationKey ?? null,
    locationLat: setting?.locationLat ?? null,
    locationLon: setting?.locationLon ?? null,
  };
  const location = resolveTickLocation(
    {
      locationKey: settings.locationKey,
      locationLat: settings.locationLat,
      locationLon: settings.locationLon,
    },
    env.LOCATION_DEFAULT_KEY,
  );
  const prayer = getDhuhrAsr(localDate, location.lat, location.lon);
  const active =
    user === null ? null : await db.activeSession.findUnique({ where: { userId: user.id } });
  const stats =
    user === null
      ? {
          minutesDicoding: 0,
          minutesClinForm: 0,
          targetDicoding: 60,
          targetClinForm: 60,
          streakDays: 0,
        }
      : await todayProgress(user.id, at);
  const existing =
    user === null
      ? {}
      : Object.fromEntries(
          (
            await db.reminderEvent.findMany({
              where: { userId: user.id, localDate },
              select: { eventKey: true, status: true, claimedAt: true },
            })
          ).map((c) => [c.eventKey, { status: c.status, claimedAt: c.claimedAt }]),
        );

  const dueKeys = new Set(
    runReminderTick({
      now: at,
      settings,
      location,
      hasActiveSession: active !== null,
      activeTrack: active?.track ?? null,
      stats,
      existing,
    }).map((d) => d.eventKey),
  );
  const plan = buildDayPlan({
    localDate,
    weekday,
    settings,
    location,
    hasActiveSession: active !== null,
    activeTrack: active?.track ?? null,
    stats,
  });

  console.log(`at=${at.toISOString()} (${formatWibHm(at)} WIB, ${localDate}, hari ke-${weekday})`);
  console.log(
    `lokasi=${location.label} dzuhur=${formatWibHm(prayer.dhuhr)} ashar=${formatWibHm(prayer.asr)}`,
  );
  if (usingDefaults) console.log("catatan: DB kosong, memakai setting default");
  if (plan === null) {
    console.log("hari non-aktif: tidak ada event");
    return;
  }
  console.log("eventKey | waktu WIB | status");
  for (const item of plan) {
    if (item === null) {
      console.log("(dilewati aturan RESUME, sisa ke dayEnd <20 mnt)");
      continue;
    }
    const windowEnd = addMinutes(item.dueAt, REMINDER_WINDOW_MINUTES);
    let status: string;
    if (at < item.dueAt) status = "terjadwal";
    else if (at >= windowEnd) status = "basi (lewat jendela)";
    else if (dueKeys.has(item.key)) status = "JATUH TEMPO";
    else status = "sudah SENT";
    console.log(`${item.key} | ${formatWibHm(item.dueAt)} | ${status}`);
  }
  await db.$disconnect();
}

void main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : "simulate gagal");
  void db.$disconnect();
  process.exit(1);
});
