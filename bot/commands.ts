import type { Bot } from "grammy";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { getPreset, LOCATION_PRESETS } from "../lib/locations";
import { getDhuhrAsr } from "../lib/prayer";
import { buildDayPlan, resolveTickLocation } from "../lib/reminder";
import { formatWibHm, wibDateKey, wibWeekday } from "../lib/time";
import {
  latitudeSchema,
  longitudeSchema,
  noteSchema,
  roundCoord,
  trackSchema,
} from "../lib/validation";
import { todayProgress } from "../services/reminderService";
import { createAllowlistGuard } from "./security";
import { jadwalMessage, lokasiListMessage, progressLine } from "./texts";

const MAX_SESSION_MINUTES = 240;

const KNOWN_COMMANDS = ["mulai", "selesai", "hari_ini", "jadwal", "lokasi"] as const;

export const HELP_TEXT =
  "Perintah: /mulai <dicoding|clinform> [menit], /selesai [catatan], /hari_ini, /jadwal, /lokasi [kunci]";

/** Menu perintah untuk setMyCommands (muncul di klien Telegram). */
export const BOT_COMMANDS: Array<{ command: string; description: string }> = [
  { command: "mulai", description: "Mulai sesi belajar" },
  { command: "selesai", description: "Tutup sesi + catatan" },
  { command: "hari_ini", description: "Progres hari ini" },
  { command: "jadwal", description: "Jadwal + jam sholat hari ini" },
  { command: "lokasi", description: "Lihat/atur lokasi" },
];

/**
 * Teks bantuan bila pesan adalah perintah TAK dikenal; null bila bukan
 * perintah atau sudah dikenal (sudah ditangani handler lain).
 */
export function unknownCommandReply(text: string): string | null {
  const first = text.trim().split(/\s+/)[0] ?? "";
  if (!first.startsWith("/")) return null;
  const name = first.slice(1).split("@")[0]?.toLowerCase() ?? "";
  if ((KNOWN_COMMANDS as readonly string[]).includes(name)) return null;
  return HELP_TEXT;
}

export interface LocationSetting {
  locationKey: string | null;
  locationLat: number | null;
  locationLon: number | null;
}

/**
 * Label lokasi aktif. "lokasi kiriman" HANYA bila koordinat benar-benar ada;
 * bila belum memilih apa pun, tampilkan preset default + "(default)".
 */
export function activeLocationLabel(setting: LocationSetting | null, defaultKey: string): string {
  const key = setting?.locationKey;
  if (typeof key === "string" && key !== "") {
    return getPreset(key)?.name ?? "lokasi kiriman";
  }
  if (typeof setting?.locationLat === "number" && typeof setting?.locationLon === "number") {
    return "lokasi kiriman";
  }
  const preset = getPreset(defaultKey);
  return preset === null ? `${defaultKey} (default)` : `${preset.name} (default)`;
}

async function singleUserId(): Promise<string | null> {
  const user = await db.user.findFirst({ select: { id: true } });
  return user?.id ?? null;
}

/** Parse "/mulai <track> [menit]". Diekspor untuk unit test. */
export function parseMulaiArgs(
  text: string,
): { ok: true; track: "DICODING" | "CLINFORM"; minutes: number | null } | { ok: false } {
  const args = text.split(/\s+/).slice(1);
  const track = trackSchema.safeParse(args[0] ?? "");
  if (!track.success) return { ok: false };
  if (args[1] === undefined) return { ok: true, track: track.data, minutes: null };
  if (!/^\d+$/.test(args[1])) return { ok: false };
  const minutes = Number(args[1]);
  if (minutes < 1 || minutes > 180) return { ok: false };
  return { ok: true, track: track.data, minutes };
}

const MULAI_USAGE = "Pakai: /mulai <dicoding|clinform> [menit 1-180]";

export function registerCommands(bot: Bot): void {
  // Allowlist: chat lain diabaikan diam-diam (tanpa next, tanpa balasan).
  bot.use(createAllowlistGuard(env.TELEGRAM_ALLOWED_CHAT_IDS));

  bot.command("mulai", async (ctx) => {
    const userId = await singleUserId();
    if (userId === null) {
      await ctx.reply("Belum ada user. Jalankan seed dulu.");
      return;
    }
    const parsed = parseMulaiArgs(ctx.msg?.text ?? "");
    if (!parsed.ok) {
      await ctx.reply(MULAI_USAGE);
      return;
    }
    const setting = await db.userSetting.findUnique({ where: { userId } });
    const planned = parsed.minutes ?? setting?.defaultFocusMin ?? 25;
    const active = await db.activeSession.findUnique({ where: { userId } });
    if (active !== null) {
      await ctx.reply(
        `Sudah ada sesi aktif ${active.track} sejak ${formatWibHm(active.startedAt)} WIB. /selesai dulu.`,
      );
      return;
    }
    await db.activeSession.create({
      data: { userId, track: parsed.track, startedAt: new Date(), plannedFocusMin: planned },
    });
    await ctx.reply(`Mulai ${parsed.track} ${planned} menit. Semangat.`);
  });

  bot.command("selesai", async (ctx) => {
    const userId = await singleUserId();
    if (userId === null) {
      await ctx.reply("Belum ada user. Jalankan seed dulu.");
      return;
    }
    const active = await db.activeSession.findUnique({ where: { userId } });
    if (active === null) {
      await ctx.reply("Tidak ada sesi aktif. Mulai dulu dengan /mulai.");
      return;
    }
    const noteText = (ctx.msg?.text ?? "").split(/\s+/).slice(1).join(" ");
    if (noteText !== "") {
      const note = noteSchema.safeParse(noteText);
      if (!note.success) {
        await ctx.reply("Catatan maksimal 280 karakter. Sesi belum ditutup.");
        return;
      }
    }
    const now = new Date();
    const durationMin = Math.max(
      1,
      Math.floor((now.getTime() - active.startedAt.getTime()) / 60000),
    );
    if (durationMin > MAX_SESSION_MINUTES) {
      // Sesi basi (lupa /selesai): hapus sesi aktif agar tidak macet,
      // tanpa mencatat angka yang tidak tepercaya.
      await db.activeSession.delete({ where: { userId } });
      await ctx.reply(
        `Sesi lebih dari ${MAX_SESSION_MINUTES} menit, tidak dicatat. Sesi aktif dibersihkan; catat manual bila perlu.`,
      );
      return;
    }
    await db.$transaction([
      db.activeSession.delete({ where: { userId } }),
      db.studySession.create({
        data: {
          userId,
          track: active.track,
          startedAt: active.startedAt,
          endedAt: now,
          durationMin,
          note: noteText === "" ? null : noteText,
          plannedFocusMin: active.plannedFocusMin,
        },
      }),
    ]);
    const stats = await todayProgress(userId, now);
    await ctx.reply(`Selesai ${active.track} ${durationMin} menit. ${progressLine(stats)}`);
  });

  bot.command("hari_ini", async (ctx) => {
    const userId = await singleUserId();
    if (userId === null) {
      await ctx.reply("Belum ada user. Jalankan seed dulu.");
      return;
    }
    const stats = await todayProgress(userId, new Date());
    await ctx.reply(`Progres ${stats.localDate}: ${progressLine(stats)}`);
  });

  bot.command("jadwal", async (ctx) => {
    const userId = await singleUserId();
    if (userId === null) {
      await ctx.reply("Belum ada user. Jalankan seed dulu.");
      return;
    }
    const now = new Date();
    const setting = await db.userSetting.findUnique({ where: { userId } });
    if (setting === null) {
      await ctx.reply("Setting belum ada.");
      return;
    }
    const location = resolveTickLocation(
      {
        locationKey: setting.locationKey,
        locationLat: setting.locationLat,
        locationLon: setting.locationLon,
      },
      env.LOCATION_DEFAULT_KEY,
    );
    const localDate = wibDateKey(now);
    const prayer = getDhuhrAsr(localDate, location.lat, location.lon);
    const active = await db.activeSession.findUnique({ where: { userId } });
    const stats = await todayProgress(userId, now);
    const plan = buildDayPlan({
      localDate,
      weekday: wibWeekday(now),
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
    });
    if (plan === null) {
      await ctx.reply("Hari ini non-aktif. Ubah activeDays bila keliru.");
      return;
    }
    const labels: Record<string, string> = {
      STUDY_START: "Mulai belajar",
      DZUHUR_BREAK: "Istirahat Dzuhur",
      DZUHUR_RESUME: "Lanjut belajar",
      ASHAR_BREAK: "Istirahat Ashar",
      ASHAR_RESUME: "Lanjut belajar",
      DAY_END: "Ringkasan harian",
    };
    const rows = plan
      .filter((p) => p !== null)
      .map((p) => ({ label: labels[p.key] ?? p.key, hm: formatWibHm(p.dueAt) }));
    await ctx.reply(
      jadwalMessage(location.label, rows, formatWibHm(prayer.dhuhr), formatWibHm(prayer.asr)),
    );
  });

  bot.command("lokasi", async (ctx) => {
    const userId = await singleUserId();
    if (userId === null) {
      await ctx.reply("Belum ada user. Jalankan seed dulu.");
      return;
    }
    const arg = (ctx.msg?.text ?? "").split(/\s+/)[1];
    const setting = await db.userSetting.findUnique({ where: { userId } });
    if (arg === undefined || arg === "") {
      await ctx.reply(
        lokasiListMessage(
          activeLocationLabel(setting, env.LOCATION_DEFAULT_KEY),
          Object.values(LOCATION_PRESETS).map((p) => ({ key: p.key, name: p.name })),
        ),
      );
      return;
    }
    const preset = getPreset(arg);
    if (preset === null) {
      await ctx.reply("Kunci tidak dikenal. Pilih dari daftar preset.");
      return;
    }
    await db.userSetting.upsert({
      where: { userId },
      create: { userId, locationKey: preset.key, locationLat: null, locationLon: null },
      update: { locationKey: preset.key, locationLat: null, locationLon: null },
    });
    await ctx.reply(`Lokasi: ${preset.name}.`);
  });

  // Perintah tak dikenal dari allowlist -> daftar singkat. Non-allowlist
  // sudah disaring guard di atas sehingga tetap diam. Handler ini jalan juga
  // untuk perintah dikenal, tapi mengembalikan null (diam) untuk mereka.
  bot.on("message:text", async (ctx) => {
    const reply = unknownCommandReply(ctx.msg?.text ?? "");
    if (reply !== null) {
      await ctx.reply(reply);
    }
  });

  // Terima pesan lokasi (latitude/longitude) hanya dari allowlist.
  // edited_message (live-location) tidak didaftarkan -> diabaikan.
  // Koordinat TIDAK ditulis ke log/pesan.
  bot.on("message:location", async (ctx) => {
    const userId = await singleUserId();
    if (userId === null) return;
    const loc = ctx.msg?.location;
    if (loc === undefined) return;
    const lat = latitudeSchema.safeParse(loc.latitude);
    const lon = longitudeSchema.safeParse(loc.longitude);
    if (!lat.success || !lon.success) {
      await ctx.reply("Lokasi tidak valid.");
      return;
    }
    await db.userSetting.upsert({
      where: { userId },
      create: {
        userId,
        locationKey: null,
        locationLat: roundCoord(lat.data),
        locationLon: roundCoord(lon.data),
      },
      update: {
        locationKey: null,
        locationLat: roundCoord(lat.data),
        locationLon: roundCoord(lon.data),
      },
    });
    await ctx.reply("Lokasi diperbarui, akurasi sekitar 1 km.");
  });
}
