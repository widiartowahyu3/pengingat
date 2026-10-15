// Dipakai SEBELUM import modul tes apa pun: sediakan env valid agar
// lib/env (fail-fast) tidak menggagalkan boot. Nilai dummy, bukan secret.
// DATABASE_URL SELALU ditimpa ke database tes (fungsi bersama) agar tidak
// ada tes yang menyentuh DB dev — lihat assertTestDatabaseUrl.
import { testDatabaseUrl } from "./helpers/test-db-url";

process.env.DATABASE_URL = testDatabaseUrl();
for (const [key, value] of Object.entries({
  SESSION_SECRET: "t".repeat(32),
  TELEGRAM_BOT_TOKEN: "123456:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  TELEGRAM_WEBHOOK_SECRET: "w".repeat(16),
  TELEGRAM_ALLOWED_CHAT_IDS: "111",
  CRON_SECRET: "c".repeat(16),
  BOT_MODE: "polling",
  LOCATION_DEFAULT_KEY: "yogyakarta",
  NODE_ENV: "test",
})) {
  if (process.env[key] === undefined || process.env[key] === "") {
    process.env[key] = value;
  }
}
