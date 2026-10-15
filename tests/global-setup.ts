// Sekali per `npm test`: terapkan migrasi ke database tes terpisah.
// Database tes (+ shadow) dibuat oleh init Docker (scripts/docker-initdb),
// jadi di sini tidak ada CREATE. Database dev tidak tersentuh.
import { execSync } from "node:child_process";
import { testDatabaseUrl } from "./helpers/test-db-url";

export default async function globalSetup(): Promise<void> {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: "pipe",
  });
}
