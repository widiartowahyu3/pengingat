import { db } from "../../lib/db";

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
