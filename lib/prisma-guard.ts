// Pengaman database jarak jauh untuk tooling CLI (bukan runtime).
// Dipakai prisma.config.ts dan scripts/seed-user.ts. Runtime (Vercel/Neon)
// TIDAK memakai modul ini. Murni: tanpa I/O, tanpa import env.
//
// Keputusan berbasis ARGUMEN POSISIONAL (token "-" diabaikan), fail-closed:
// - Tanpa koneksi DB (generate, validate, format, --help, --version):
//   selalu diizinkan, tanpa flag.
// - never-remote (ditolak untuk non-lokal WALAU ber-flag): migrate reset,
//   db push, migrate dev, db execute. Lapis kedua: kata "reset"/"push" di
//   argumen posisional mana pun -> never-remote.
// - Sisanya (migrate deploy/status/resolve/diff, db pull/seed, studio,
//   seed-user, perintah tak dikenal): non-lokal hanya dengan ALLOW_REMOTE_DB=1.
// - Loopback = daftar eksplisit {localhost, 127.0.0.1, [::1]}. Seluruh
//   127.0.0.0/8 SENGAJA tidak dibuka borongan: dev/prod memakai 127.0.0.1,
//   dan allowlist eksplisit mencegah salah sangka host seperti 127.0.0.2.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** URL placeholder loopback untuk perintah tanpa DB (tak pernah dikoneksi). */
const OFFLINE_PLACEHOLDER_URL = "postgresql://localhost:5432/offline";

function hostOf(url: string): string {
  try {
    // new URL() memberi hostname IPv6 dengan kurung: "[::1]".
    return new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error("URL database tidak valid.");
  }
}

function denyRemote(host: string, extra: string): never {
  // Pesan hanya memuat NAMA HOST, tanpa kredensial.
  throw new Error(`Menolak: target database bukan lokal (host: ${host}). ${extra}`);
}

/**
 * Menolak bila URL bukan loopback lokal, kecuali ALLOW_REMOTE_DB=1.
 * Dipakai operasi tulis/manual (seed). Pesan hanya berisi host.
 */
export function guardRemoteDatabase(url: string): void {
  const host = hostOf(url);
  if (LOOPBACK_HOSTS.has(host)) return;
  if (process.env.ALLOW_REMOTE_DB === "1") return;
  denyRemote(host, "Set ALLOW_REMOTE_DB=1 untuk lanjut.");
}

type CommandGroup = "no-db" | "never-remote" | "needs-flag";

const NO_DB_COMMANDS = new Set(["generate", "validate", "format"]);

/** Kelompokkan perintah Prisma dari argv (murni, untuk unit test). */
export function classifyPrismaCommand(argv: string[]): CommandGroup {
  const raw = argv.slice(2);
  if (
    raw.includes("--help") ||
    raw.includes("-h") ||
    raw.includes("--version") ||
    raw.includes("-v")
  ) {
    return "no-db";
  }
  // Argumen posisional: abaikan semua token berawalan "-" (flag dan
  // bentuk "--flag=nilai"), agar flag di mana pun tak mengecoh klasifikasi.
  const positional = raw.filter((t) => !t.startsWith("-")).map((t) => t.toLowerCase());
  if (positional.length === 0) return "no-db";
  // Lapis kedua: kata berbahaya di posisi mana pun -> never-remote.
  if (positional.includes("reset") || positional.includes("push")) {
    return "never-remote";
  }
  const [first, second] = positional;
  if (first === undefined || NO_DB_COMMANDS.has(first)) return "no-db";
  if (
    (first === "migrate" && second === "reset") ||
    (first === "db" && second === "push") ||
    (first === "migrate" && second === "dev") ||
    (first === "db" && second === "execute")
  ) {
    return "never-remote";
  }
  return "needs-flag";
}

/**
 * URL untuk CLI Prisma: DIRECT_URL bila diisi, fallback DATABASE_URL.
 * Perintah tanpa DB tidak butuh URL asli (placeholder loopback).
 */
export function resolveCliDatabaseUrl(argv: string[] = process.argv): string {
  const group = classifyPrismaCommand(argv);
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    if (group === "no-db") return OFFLINE_PLACEHOLDER_URL;
    throw new Error("DIRECT_URL atau DATABASE_URL wajib diisi.");
  }
  const host = hostOf(url);
  if (LOOPBACK_HOSTS.has(host)) return url;
  if (group === "no-db") return url;
  if (group === "never-remote") {
    denyRemote(host, "Perintah ini tidak boleh menyentuh database non-lokal.");
  }
  if (process.env.ALLOW_REMOTE_DB === "1") return url;
  denyRemote(host, "Set ALLOW_REMOTE_DB=1 untuk lanjut.");
}
