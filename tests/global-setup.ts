// Sekali per `npm test`: terapkan migrasi ke database tes terpisah.
// Database tes (+ shadow) dibuat oleh init Docker (scripts/docker-initdb),
// jadi di sini tidak ada CREATE. Database dev tidak tersentuh.
import { execSync } from "node:child_process";

function testDatabaseUrl(): string {
  const pgUser = process.env.POSTGRES_USER ?? "study";
  const pgPass = process.env.POSTGRES_PASSWORD ?? "study";
  const port = process.env.PGPORT ?? "5435";
  return `postgresql://${pgUser}:${pgPass}@127.0.0.1:${port}/study_timer_test`;
}

export default async function globalSetup(): Promise<void> {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: "pipe",
  });
}
