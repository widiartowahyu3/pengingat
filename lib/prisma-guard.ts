// Pengaman database jarak jauh untuk tooling CLI (bukan runtime).
// Dipakai prisma.config.ts dan scripts/seed-user.ts. Runtime (Vercel/Neon)
// TIDAK memakai modul ini. Murni: tanpa I/O, tanpa import env.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error("URL database tidak valid.");
  }
}

/**
 * Menolak bila URL bukan loopback lokal, kecuali ALLOW_REMOTE_DB=1.
 * Pesan hanya memuat NAMA HOST, tanpa kredensial.
 */
export function guardRemoteDatabase(url: string): void {
  const host = hostOf(url);
  if (LOOPBACK_HOSTS.has(host)) return;
  if (process.env.ALLOW_REMOTE_DB === "1") return;
  throw new Error(
    `Menolak: target database bukan lokal (host: ${host}). Set ALLOW_REMOTE_DB=1 untuk lanjut.`,
  );
}

/**
 * URL untuk CLI Prisma: DIRECT_URL bila diisi, fallback DATABASE_URL lokal.
 * Keduanya dijaga guardRemoteDatabase.
 */
export function resolveCliDatabaseUrl(): string {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    throw new Error("DIRECT_URL atau DATABASE_URL wajib diisi.");
  }
  guardRemoteDatabase(url);
  return url;
}
