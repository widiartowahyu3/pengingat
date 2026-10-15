// Satu-satunya penyusun URL database TES. Dipakai tests/setup.ts,
// tests/global-setup.ts, dan tests/helpers/db.ts — tidak ada tempat lain
// yang boleh menyusun URL tes sendiri. Penolakan TIDAK bisa dilewati
// ALLOW_REMOTE_DB (flag itu tidak dibaca di sini sama sekali).

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface TestDbParts {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
}

function failInvalid(host: string, database: string): never {
  // Hanya nama host + nama database, tanpa kredensial.
  throw new Error(
    `URL database tes tidak valid (host: ${host}, database: ${database}). ` +
      `Host harus loopback dan nama database harus berakhiran "_test".`,
  );
}

/** Susun + validasi URL database tes. Melempar bila tidak memenuhi syarat. */
export function buildTestDatabaseUrl(parts: TestDbParts): string {
  const host = parts.host.toLowerCase();
  if (!LOOPBACK_HOSTS.has(host)) {
    failInvalid(parts.host, parts.database);
  }
  if (!Number.isInteger(parts.port) || parts.port < 1 || parts.port > 65535) {
    failInvalid(parts.host, parts.database);
  }
  if (!parts.database.endsWith("_test")) {
    failInvalid(parts.host, parts.database);
  }
  return `postgresql://${parts.user}:${parts.password}@${parts.host}:${parts.port}/${parts.database}`;
}

/** URL database tes dari konvensi dev lokal (env POSTGRES_xxx dan PGPORT). */
export function testDatabaseUrl(): string {
  return buildTestDatabaseUrl({
    // Nilai default di bawah hanya konvensi dev lokal, bukan secret.
    user: process.env.POSTGRES_USER ?? "study",
    password: process.env.POSTGRES_PASSWORD ?? "study",
    host: "127.0.0.1",
    port: Number(process.env.PGPORT ?? 5435),
    database: "study_timer_test",
  });
}

/**
 * Berhenti sebelum menyentuh data bila DATABASE_URL lingkungan bukan URL
 * database tes. Dipanggil tests/helpers/db.ts saat modul dimuat.
 */
export function assertTestDatabaseUrl(envUrl: string | undefined, expectedUrl: string): void {
  if (envUrl !== undefined && envUrl !== "" && envUrl !== expectedUrl) {
    throw new Error(
      "DATABASE_URL lingkungan bukan database tes; tes berhenti sebelum menyentuh data.",
    );
  }
}
