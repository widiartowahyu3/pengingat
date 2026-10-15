import { z } from "zod";
import { LOCATION_PRESET_KEYS } from "./locations";

// Kenapa fail-fast di sini: aplikasi tidak boleh berjalan dengan secret yang
// hilang/lemah, daripada gagal diam-diam saat request pertama masuk.

const chatIdsSchema = z
  .string()
  .min(1, "TELEGRAM_ALLOWED_CHAT_IDS wajib diisi")
  .regex(/^(\d+)(,\d+)*$/, "format: angka dipisah koma tanpa spasi, mis. 123,456")
  .transform((s) => s.split(",").map(Number));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL wajib diisi")
    .refine((s) => s.startsWith("postgresql://") || s.startsWith("postgres://"), {
      message: "DATABASE_URL harus URL Postgres",
    }),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET minimal 32 karakter"),
  TELEGRAM_BOT_TOKEN: z
    .string()
    .min(1, "TELEGRAM_BOT_TOKEN wajib diisi")
    .regex(/^\d+:[\w-]{20,}$/, "format TELEGRAM_BOT_TOKEN tidak valid"),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16, "TELEGRAM_WEBHOOK_SECRET minimal 16 karakter"),
  TELEGRAM_ALLOWED_CHAT_IDS: chatIdsSchema,
  CRON_SECRET: z.string().min(16, "CRON_SECRET minimal 16 karakter"),
  APP_BASE_URL: z
    .string()
    .refine(
      (s) => {
        try {
          return new URL(s).protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "APP_BASE_URL harus URL https" },
    )
    .optional(),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  BOT_MODE: z.enum(["polling", "webhook"]).default("polling"),
  LOCATION_DEFAULT_KEY: z
    .string()
    .regex(/^[a-z0-9_]{1,32}$/, "kunci lokasi tidak valid")
    .refine((k) => (LOCATION_PRESET_KEYS as readonly string[]).includes(k), {
      message: "LOCATION_DEFAULT_KEY harus salah satu preset lokasi",
    })
    .default("yogyakarta"),
});

export type Env = z.output<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Sengaja hanya tampilkan NAMA key, bukan nilainya, agar secret tidak bocor ke log.
    const keys = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "unknown")))];
    throw new Error(`Konfigurasi environment tidak valid: ${keys.join(", ")}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();
