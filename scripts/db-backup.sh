#!/usr/bin/env sh
# Backup pg_dump database dev. pg_dump dijalankan DI DALAM kontainer sehingga
# variabel $POSTGRES_* diperluas di sana (bukan oleh shell host yang kosong).
# Host hanya menerima stdout dump. Aturan: tanpa password/isi dump di layar,
# file final hanya bila pg_dump sukses DAN tidak kosong, izin 600.
set -eu

mkdir -p backups
tmp="$(mktemp backups/.backup-XXXXXX.sql)"
trap 'rm -f "$tmp"' EXIT HUP INT TERM

if docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$tmp" 2>/dev/null && [ -s "$tmp" ]; then
  out="backups/study_timer_$(date +%F_%H%M).sql"
  chmod 600 "$tmp"
  mv "$tmp" "$out"
  trap - EXIT HUP INT TERM
  echo "backup: $out ($(wc -c < "$out") bytes)"
else
  echo "backup gagal" >&2
  exit 1
fi
