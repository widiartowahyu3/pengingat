# PLAN.md — Study Timer

Sumber kebenaran status tahap. Diperbarui di akhir tiap tahap.

## Tahap

| Tahap          | Isi                                                                      | Status                                | Tanggal    |
| -------------- | ------------------------------------------------------------------------ | ------------------------------------- | ---------- |
| Tahap 0        | Rencana jadwal + sholat (skema, runReminderTick, event, tes, pertanyaan) | Rencana selesai, menunggu persetujuan | 2026-10-11 |
| Tahap A        | Service inti + bot + pengingat terjadwal                                 | Selesai                               | 2026-10-11 |
| Uji live lokal | Isi .env, seed, deleteWebhook, `npm run bot`, uji perintah Telegram      | Belum mulai                           | -          |
| Tahap C        | Deploy Vercel + Neon + cron-job.org                                      | Belum mulai                           | -          |
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
