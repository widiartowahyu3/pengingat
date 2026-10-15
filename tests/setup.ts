// Dipakai SEBELUM import modul tes apa pun: sediakan env valid agar
// lib/env (fail-fast) tidak menggagalkan boot. Nilai dummy, bukan secret.
// DATABASE_URL menunjuk database TES terpisah (bukan dev).
// DB tes disiapkan tests/global-setup.ts.
if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === "") {
  // Kredensial mengikuti Postgres dev (lihat .env.example: POSTGRES_*).
  // Default di bawah hanya konvensi dev lokal, bukan secret.
  const pgUser = process.env.POSTGRES_USER ?? "study";
  const pgPass = process.env.POSTGRES_PASSWORD ?? "study";
  const port = process.env.PGPORT ?? "5435";
  process.env.DATABASE_URL = `postgresql://${pgUser}:${pgPass}@127.0.0.1:${port}/study_timer_test`;
}
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
