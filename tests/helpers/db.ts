import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { assertTestDatabaseUrl, testDatabaseUrl } from "./test-db-url";

// Koneksi database TES dari fungsi bersama — BUKAN DATABASE_URL lingkungan.
// Berhenti saat import bila env menunjuk ke bukan-DB-tes (sebelum query apa pun).
const url = testDatabaseUrl();
assertTestDatabaseUrl(process.env.DATABASE_URL, url);

const adapter = new PrismaPg({ connectionString: url });

export const db: PrismaClient = new PrismaClient({ adapter });

// Helper database TES terpisah. Urutan hapus mengikuti foreign key.
export async function cleanTestDb(): Promise<void> {
  await db.reminderEvent.deleteMany();
  await db.activeSession.deleteMany();
  await db.studySession.deleteMany();
  await db.dailyTarget.deleteMany();
  await db.userSetting.deleteMany();
  await db.webSession.deleteMany();
  await db.telegramProcessedUpdate.deleteMany();
  await db.loginAttempt.deleteMany();
  await db.maintenanceState.deleteMany();
  await db.user.deleteMany();
}

export async function createTestUser(): Promise<string> {
  const user = await db.user.create({
    data: {
      passwordHash: "bukan-hash-asli",
      targets: {
        create: [
          { track: "DICODING", minutesPerDay: 60 },
          { track: "CLINFORM", minutesPerDay: 60 },
        ],
      },
      setting: { create: { locationKey: "yogyakarta" } },
    },
    select: { id: true },
  });
  return user.id;
}
