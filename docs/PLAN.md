# PLAN.md — Study Timer

Sumber kebenaran status tahap. Diperbarui di akhir tiap tahap.

## Tahap

| Tahap          | Isi                                                                      | Status                                | Tanggal    |
| -------------- | ------------------------------------------------------------------------ | ------------------------------------- | ---------- |
| Tahap 0        | Rencana jadwal + sholat (skema, runReminderTick, event, tes, pertanyaan) | Rencana selesai, menunggu persetujuan | 2026-10-11 |
| Tahap A        | Service inti + bot + pengingat terjadwal                                 | Selesai                               | 2026-10-11 |
| Uji live lokal | Isi .env, seed, deleteWebhook, `npm run bot`, uji perintah Telegram      | Belum mulai                           | -          |
| Tahap C        | Deploy Vercel + Neon + cron-job.org (rencana di bawah)                   | Menunggu persetujuan                  | 2026-10-14 |
| Tahap B        | Auth web (argon2id, session, rate limit, CSRF, security headers)         | Belum mulai                           | -          |
| Tahap D        | Dashboard web, lalu Fase 5 hardening                                     | Belum mulai                           | -          |

## Pertanyaan terbuka

(Semua pertanyaan Tahap 0 sudah dijawab 2026-10-11: aktif setiap hari +
`activeDays`; Jumat Dzuhur 60 mnt; tanpa jeda minimum tambahan; preset
yogyakarta default + karanganyar dengan koordinat terverifikasi.)

Kalibrasi Kemenag menunggu data manual user (tabel 5 tanggal di laporan Tahap A).

## Log tahap

- 2026-10-11 Tahap A: 58 tes lolos (9 file); lint/typecheck/format/build
  bersih; audit --omit=dev tetap 4 high yang sudah diterima (SECURITY.md).
  `/selesai` >240 mnt ditolak + sesi dibersihkan (anti macet).
- 2026-10-11 Pra-tahap: tabel kalibrasi 5 tanggal (adjustments tetap nol);
  skrip `reminder:simulate`; urutan tahap diubah (uji live lokal -> C -> B
  -> D -> Fase 5); panduan `docs/UJI-LOKAL.md`.
- 2026-10-13 Perbaikan bot: label default "Yogyakarta (default)"; perintah
  tak dikenal dibalas daftar (non-allowlist diam) + setMyCommands;
  tick diam bila due=0/failed=0; vitest config .mts; 65 tes lolos.
- 2026-10-14 Tahap C disetujui + 5 penyesuaian (hemat CU via gerbang jam
  aktif 07:55-16:30; webhook domain alias; migrate/seed tanpa URL Neon di
  .env; Prisma 7 + adapter-pg + pooler terverifikasi; notifikasi cron).
- 2026-10-14 Eksekusi 4 perubahan Tahap C: DIRECT_URL fallback + guard
  remote-DB (config+seed); gerbang jam + maxDuration 60 + validasi setting;
  tes route 401/404; postinstall generate + engines 22.x + bukti build
  bersih. Tes murni 66/66; suite penuh + cabang skipped menunggu Docker.
- 2026-10-14 Guard berbasis perintah: no-db selalu lolos (ALLOW_REMOTE_DB
  dihapus dari env Vercel + peringatan vercel env pull/.env); reset/push
  selalu ditolak remote; seed dijaga. Tes murni 76/76; bukti build bersih
  tanpa flag lolos; suite penuh menunggu Docker.
- 2026-10-14 Guard posisional + never-remote diperluas (dev/execute) +
  IPv6/lookalike + URL tes bersama (host loopback, nama *_test, tanpa
  bypass) + tes mutasi via helpers/db + assert env. Suite penuh 96/96
  (14 file) lolos dengan Docker; lint/typecheck/format/build bersih.

## Rencana Tahap C — Deploy (Vercel Hobby + Neon + cron-job.org)

Prinsip: 2 route publik saja (`POST /api/telegram/webhook`,
`POST /api/cron/reminder`); auth web/dashboard belum ada jadi tidak ada
endpoint data lain. Dev tetap polling + bot dev; prod webhook + bot kedua.

### 1. Langkah manual + env produksi (nama saja, tanpa nilai)

1. Neon Console → new project, region `aws-ap-southeast-1` (Singapura,
   terdekat; sumber: neon.com/docs/introduction/regions; region terkunci
   saat create). Catat 2 string: pooled (`...-pooler...`, runtime
   serverless) dan direct (migrasi), keduanya `?sslmode=require`
   (sumber: neon.com/docs/connect/connection-pooling: pooled untuk
   serverless, direct untuk migrasi/pg_dump).
2. Vercel → import repo → Settings → Environment Variables, scope
   Production SAJA, tipe Sensitive/Secret untuk semua kredensial (sumber:
   vercel.com/docs/environment-variables: Secret = write-only, terenkripsi):
   `DATABASE_URL` (pooled), `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN` (bot
   PROD, beda dari dev), `TELEGRAM_WEBHOOK_SECRET`,
   `TELEGRAM_ALLOWED_CHAT_IDS`, `CRON_SECRET`, `BOT_MODE=webhook`,
   `TRUST_PROXY=true`, `LOCATION_DEFAULT_KEY=yogyakarta`.
   TANPA `DIRECT_URL` dan TANPA `ALLOW_REMOTE_DB` di Vercel (generate/
   validate/format selalu diizinkan tanpa flag). `APP_BASE_URL` diisi
   SETELAH deploy pertama (domain alias) lalu redeploy. Redeploy tiap
   ubah env. PERINGATAN: jangan `vercel env pull` ke folder proyek ini
   tanpa meninjau isi (bisa membawa URL produksi ke `.env` lokal);
   jangan memakai nama `.env` untuk file berisi URL produksi (gunakan
   nama lain di luar repo + `read -s`, lalu hapus).
3. Vercel Settings → Functions → region `sin1` (sumber:
   vercel.com/docs/regions + /functions/configuring-functions/region;
   default `iad1` harus diganti agar dekat Neon Singapura).
4. Kosongkan/abaikan Preview env agar token prod tidak bocor ke preview.
5. Jalankan migrasi + seed dari mesin lokal (bagian 2), deploy, lalu
   webhook + cron (bagian 4-5), verifikasi (bagian 6).

### 2. Neon: koneksi, suspend, migrasi, seed

- Runtime (Vercel) wajib pooled (`-pooler`, PgBouncer transaction mode);
  migrasi/seed/pg_dump wajib direct (sumber: pooling doc + prisma docs
  pgbouncer: migrate butuh single connection; pola `DATABASE_URL` pooled
  - `DIRECT_URL` direct di `prisma.config.ts` — PERUBAHAN KODE, lihat bag. 8).
- Scale-to-zero: suspend setelah 5 mnt idle, bangun dalam hitungan ratus ms
  (free tidak bisa dimatikan; sumber: neon.com/docs/introduction/scale-to-zero).
  Tick 5-menitan membuat compute sering bangun; tiap bangun menambah
  1-3 dtk ke respons webhook/cron pertama — masih jauh di bawah batas 300 dtk.
- Free tier (sumber: neon.com/faqs/free-plan-limits-and-quotas; blog Okt 2026
  menyebut storage naik 1 GB — pastikan angka di konsolmu): 100 CU-jam/
  proyek/bln, storage ~0,5-1 GB, 10 branch, transfer 5 GB/bln. Habis kuota =
  compute disuspend sampai periode berikut (data tidak hilang).
- Migrasi/seed dari mesin lokal (BUKAN saat build, BUKAN dari `.env`):
  URL/token rahasia dibaca dengan `read -s` (tidak masuk riwayat shell),
  mis. `read -s DIRECT_URL` lalu
  `DIRECT_URL="$DIRECT_URL" ALLOW_REMOTE_DB=1 npx prisma migrate deploy`.
  Seed prod sekali dengan cara yang sama (webhook butuh baris User;
  password min 14 via prompt, tak tersimpan di file). Hanya `migrate deploy`
  yang boleh menyentuh Neon; `migrate dev`/`reset` ditolak guard bila URL
  non-lokal tanpa flag.

### 3. Vercel: region, durasi, proteksi, IP klien

- `sin1` (bagian 1.3). Hobby: maxDuration default = maks 300 dtk
  (sumber: vercel.com/docs/functions/limitations); tick (8 dtk timeout
  Telegram) + cleanup (≤500 baris, 1x/hari) muat longgar. Tanpa seting khusus.
- Deployment Protection: pakai Standard Protection (lindungi semua KECUALI
  domain produksi; sumber: vercel.com/docs/deployment-protection) — webhook
  dan cron di domain prod tetap terbuka, preview tetap terkunci. Jangan
  aktifkan All Deployments (akan memblokir Telegram/cron-job.org).
- IP klien (rate limit Tahap B): `TRUST_PROXY=true` di Vercel; baca
  `x-real-ip` (= `x-forwarded-for`, Vercel menimpa XFF anti-spoofing;
  sumber: vercel.com/docs/headers/request-headers + paket @vercel/functions
  `ipAddress()`). PERUBAHAN KODE kecil di Tahap B (bukan C).

### 4. Webhook (via skrip yang ada, tanpa cetak token)

1. Pastikan token prod ≠ token dev; bot lokal berhenti (`BOT_MODE` lokal
   tetap polling).
2. `npx tsx scripts/telegram-webhook.ts delete` dengan env TOKEN PROD
   (bersihkan webhook lama), lalu `... set` (URL =
   `APP_BASE_URL/api/telegram/webhook` + `secret_token`,
   `allowed_updates: ["message"]`).
3. `... commands` sekali untuk menu; `... info` untuk cek URL terdaftar.
4. Allowlist tetap berlaku di kedua mode.

### 5. cron-job.org (gratis, terkonfirmasi cukup)

Job: `POST https://<domain-prod>/api/cron/reminder` tiap 5 menit, DIBATASI
jam 07:55-16:30 WIB (jadwal cron + gerbang kode di route), header kustom
`Authorization: Bearer <CRON_SECRET>`, timezone Asia/Jakarta. Aktifkan
notifikasi email gagal. Sumber: cron-job.org/en/faq — gratis, metode POST +
header kustom sembarang didukung, s/d 60x/jam, TIMEOUT 30 dtk per request
(anggaran tick <25 dtk: bangun Neon + timeout Telegram 8 dtk), respons
disimpan 2 hari, riwayat 50 eksekusi; job gagal >25x beruntun dinonaktifkan
otomatis; ToS: tanpa garansi uptime. Alternatif bila bermasalah: GitHub
Actions `schedule` tiap 5 mnt atau Healthchecks.io + cron lokal.
Idempotensi klaim membuat retry ganda aman. Hentikan bot dev (`npm run bot`)
SETELAH webhook produksi aktif (satu token satu mode).

### 6. Verifikasi pasca-deploy

1. `POST /api/cron/reminder` tanpa header -> 401; dengan Bearer salah -> 401.
2. `POST /api/telegram/webhook` tanpa/salah secret -> 401; dengan secret
   benar + `update_id` duplikat -> 200 tanpa pesan ganda.
3. Pesan Telegram dari nomor non-allowlist -> diabaikan (tanpa balasan/log).
4. `reminder:simulate` lokal untuk jam berikut + tunggu tick cron asli:
   pesan STUDY_START/DZUHUR/ASHAR/DAY_END masuk tepat dalam jendelanya.
5. Cek log Vercel: tidak ada token/catatan; cek Neon: 1 baris per event
   (`SENT`), tidak ganda.

### 7. Risiko, batas free tier, rollback, cek manual

- Vercel Hobby: konkurensi/eksekusi terbatas; cron tiap 5 mnt = ~8,6 rb
  hit/bln (di bawah batas wajar Hobby, pantau dasbor). Neon sleep membuat
  respons pertama lambat — normal.
- cron-job.org tanpa SLA: bila mati, pengingat berhenti diam-diam sampai
  notifikasi email dibaca — pertimbangkan monitor cadangan (bagian 5).
- Rollback: redeploy commit sebelumnya di Vercel + (bila skema berubah)
  `migrate deploy` maju (tak ada downgrade skema otomatis). Data aman:
  suspend Neon tidak menghapus data.
- Cek manual: angka storage/CU di konsol Neon; URL webhook di `info`;
  2 token berbeda di @BotFather; tidak ada secret di log/build.

### 8. Perubahan kode Tahap C (DISETUJUI + penyesuaian, status di bawah)

1. SELESAI 2026-10-14. `prisma.config.ts`: `datasource.url` dari
   `DIRECT_URL` (fallback `DATABASE_URL`); `DIRECT_URL` TIDAK wajib di
   runtime dan TIDAK ada di Vercel. Pengaman remote-DB di config + seed:
   tolak host non-loopback kecuali `ALLOW_REMOTE_DB=1` (pesan hanya host).
2. SELESAI 2026-10-14. Gerbang jam aktif 07:55–16:30 (`ACTIVE_*` bersama di
   `lib/reminder.ts`, dipakai validasi setting + gerbang cron); route cron
   keluar sebelum query DB + `maxDuration = 60` (batas Hobby 300 dtk,
   timeout cron 30 dtk, anggaran tick <25 dtk); cleanup hanya di jam aktif.
   Validasi: `studyStartWib` ≥ 07:55, `dayEndWib` + 20 mnt ≤ 16:30.
3. SELESAI 2026-10-14. Route: cron tanpa Bearer → 401, tanpa `GET`
   (405/404 runtime); webhook 404 saat polling, tanpa secret → 401.
   Pemeriksaan host webhook DIBATALKAN (redundan). Util `x-real-ip`
   DITUNDA ke Tahap B.
4. SELESAI 2026-10-14. Build Vercel: `postinstall: prisma generate` +
   `engines.node 22.x`; bukti build checkout bersih (`npm ci` + build
   env dummy) lolos; guard non-lokal terbukti menolak tanpa flag.
