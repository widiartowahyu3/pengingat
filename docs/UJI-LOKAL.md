# Uji Live Lokal (Bot Polling)

Tanpa nilai secret di mana pun. Token bot dev BERBEDA dari token prod.

## 1. Isi `.env`

Salin `.env.example` ke `.env`, isi: `DATABASE_URL` + `SHADOW_DATABASE_URL`
(arah ke Postgres Docker di bawah), `POSTGRES_USER` + `POSTGRES_PASSWORD` +
`POSTGRES_DB` (kredensial dev, harus cocok dengan `DATABASE_URL`),
`SESSION_SECRET`, `TELEGRAM_BOT_TOKEN` (bot dev),
`TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ALLOWED_CHAT_IDS` (chat ID sendiri),
`CRON_SECRET`, `BOT_MODE=polling`, `LOCATION_DEFAULT_KEY=yogyakarta`,
`TRUST_PROXY=false`. Generate secret dengan `openssl rand -hex`.

## 2. Siapkan DB + seed user

```sh
npm run db:up            # Postgres 18.6 di Docker (port loopback saja).
                         # Butuh POSTGRES_* dari .env sebagai environment,
                         # mis.: export $(grep -v '^#' .env | xargs)
npm run db:migrate
npm run seed:user         # password min 14 karakter, hidden input
```

Proyek ini memakai port host 5435. Port 5433/5434 di mesin yang sama adalah
milik kontainer proyek LAIN, bukan proyek ini — pastikan `DATABASE_URL` tidak
pernah menunjuk ke port proyek lain.

Catatan volume Postgres 18: image resmi memindahkan PGDATA ke
`/var/lib/postgresql/18/docker` dan VOLUME image ke `/var/lib/postgresql`
(sumber: docker-library/docs postgres, bagian PGDATA). Karena itu
`docker-compose.yml` me-mount induk `/var/lib/postgresql`, bukan `.../data`.

Matikan: `npm run db:down` (tanpa `-v`; JANGAN `down -v` karena menghapus
volume data). Log: `npm run db:logs`. Backup: `npm run db:backup`.
Konsultasi SQL: `npm run db:psql -- -c "\l"` (argumen diteruskan ke psql).

## 3. Matikan webhook token dev

```sh
npx tsx scripts/telegram-webhook.ts delete
```

Polling dan webhook tidak boleh aktif bersamaan untuk satu token.

## 4. Jalankan bot

```sh
npm run bot
```

Ditunggu log `tick due=.. sent=.. failed=..` tiap menit. Hentikan dengan Ctrl+C.

## 5. Perintah yang diuji di Telegram

1. `/mulai dicoding 25` -> balasan mulai; `/mulai` tanpa argumen -> usage.
2. `/selesai paham middleware` -> ringkasan + progres; `/selesai` tanpa
   sesi aktif -> pesan yang sesuai.
3. `/hari_ini` -> progres + streak.
4. `/jadwal` -> rencana hari ini + Dzuhur/Ashar WIB + label lokasi.
5. `/lokasi` -> lokasi aktif + daftar preset; `/lokasi karanganyar` ->
   konfirmasi; `/lokasi salah` -> ditolak.
6. Kirim lokasi (attachment location) -> "Lokasi diperbarui, akurasi
   sekitar 1 km."; kirim ulang `/jadwal` -> label "lokasi kiriman".
7. Dari chat non-allowlist: semua perintah diabaikan diam-diam.
8. Dry-run tanpa Telegram/DB-write:
   `npm run reminder:simulate -- --at "2026-10-12T08:05:00+07:00"`.

## Memulihkan dari backup (aman, tanpa menghapus volume yang ada)

```sh
npm run db:backup                                    # simpan kondisi kini dulu
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE study_timer_restore"'
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d study_timer_restore' < backups/study_timer_YYYY-MM-DD_HHMM.sql
npm run db:psql -- -d study_timer_restore -c "\dt"   # verifikasi isi
```

Restore selalu ke database KOSONG yang baru, bukan menimpa `study_timer`.
Hapus DB restore bila tak perlu (psql: `DROP DATABASE study_timer_restore;`).

## Koneksi DBeaver (read-only)

Host `localhost`, port `5435`, database `study_timer`, user/password dari
`.env` (ketik manual, jangan simpan nilai di repo). Untuk read-only, buat
role terpisah bila perlu; minimal: jangan jalankan DDL/DELETE dari DBeaver
ke database dev, dan jangan pernah konek DBeaver ke database produksi
dengan kredensial dev.
