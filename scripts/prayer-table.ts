// Dev-only: cetak tabel kalibrasi Dzuhur/Ashar (WIB) untuk dicocokkan manual
// dengan jadwal resmi Kemenag. Bukan bagian aplikasi.
import "dotenv/config";
import { LOCATION_PRESETS } from "../lib/locations";
import { getDhuhrAsr } from "../lib/prayer";
import { formatWibHm } from "../lib/time";

const DATES = ["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-11", "2026-12-15"];

async function main(): Promise<void> {
  for (const [key, preset] of Object.entries(LOCATION_PRESETS)) {
    console.log(`Lokasi: ${key} (${preset.lat}, ${preset.lon})`);
    console.log("tanggal | dzuhur | ashar");
    for (const dateKey of DATES) {
      const t = getDhuhrAsr(dateKey, preset.lat, preset.lon);
      console.log(`${dateKey} | ${formatWibHm(t.dhuhr)} | ${formatWibHm(t.asr)}`);
    }
  }
}

void main();
