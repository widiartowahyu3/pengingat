# Catatan Keamanan — Temuan Audit Dependensi

## Diterima sementara (keputusan 2026-10-11, cek ulang di Fase 5)

`npm audit --omit=dev` melaporkan 4 temuan high:

- `deepmerge-ts <8.0.0` — stack exhaustion (GHSA-ggr8-5vv4-36mx)
- `mysql2 <=3.23.0` — auth downgrade + zlib bomb (2 CVE)

Jalur dependensi (runtime, bukan dev-only):

```
pengingat → @prisma/client@7.10.0 → prisma@7.10.0 → @prisma/config → deepmerge-ts
pengingat → @prisma/client@7.10.0 → prisma@7.10.0 → mysql2
```

Di Prisma 7, paket CLI `prisma` adalah dependensi runtime `@prisma/client`,
jadi pemisahan devDependencies tidak menghilangkan temuan ini.

Alasan diterima sementara (tanpa downgrade, tanpa overrides):

1. Kedua paket tidak pernah di-load saat aplikasi berjalan: driver database
   yang dipakai adalah `pg` via `@prisma/adapter-pg`; `mysql2` hanya dipakai
   CLI Prisma untuk proyek MySQL (kita Postgres). `deepmerge-ts` hanya dipakai
   CLI saat parsing config, bukan oleh request handler.
2. `npm audit fix --force` menuntut downgrade breaking ke `prisma@6.19.3`
   (ganti major + adapter + uji migrasi ulang) — risikonya lebih besar daripada
   temuan transitif yang tidak terjangkau dari jaringan.
3. `overrides` paksa `deepmerge-ts>=8` berisiko merusak CLI Prisma tanpa
   jaminan kompatibilitas dari upstream.

Tindak lanjut (Fase 5): cek ulang `npm audit`, pantau rilis Prisma 7.x yang
menambal kedua paket, lalu bump pin. Bila exploitability berubah (mis. kita
memakai fitur yang menyentuh kedua paket saat runtime), evaluasi ulang
langsung, jangan tunggu Fase 5.
