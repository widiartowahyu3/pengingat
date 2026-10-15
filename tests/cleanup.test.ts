import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./helpers/db";
import { addMinutes } from "../lib/time";
import { runCleanup } from "../services/cleanupService";
import { cleanTestDb, createTestUser } from "./helpers/db";

describe("runCleanup", () => {
  beforeEach(async () => {
    await cleanTestDb();
  });

  it("hapus >7 hari sekali sehari, baris baru dipertahankan", async () => {
    const userId = await createTestUser();
    const now = new Date();
    const old = addMinutes(now, -8 * 24 * 60);
    await db.reminderEvent.create({
      data: {
        userId,
        localDate: "2026-10-01",
        eventKey: "STUDY_START",
        status: "SENT",
        createdAt: old,
      },
    });
    await db.loginAttempt.create({ data: { ipHash: "x", attemptedAt: old, success: false } });
    await db.telegramProcessedUpdate.create({ data: { updateId: BigInt(1), receivedAt: old } });
    await db.reminderEvent.create({
      data: { userId, localDate: "2026-10-12", eventKey: "STUDY_START", status: "SENT" },
    });

    const first = await runCleanup(now);
    expect(first.ran).toBe(true);
    expect(first.deletedReminderEvents).toBe(1);
    expect(first.deletedLoginAttempts).toBe(1);
    expect(first.deletedTelegramUpdates).toBe(1);
    expect(await db.reminderEvent.count()).toBe(1);

    const second = await runCleanup(now);
    expect(second.ran).toBe(false);
  });
});
