import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { processTick, type TickSender } from "../services/reminderService";
import { cleanTestDb, createTestUser } from "./helpers/db";

function stubSender(inbox: string[]): TickSender {
  return {
    sendMessage: async (text: string): Promise<void> => {
      inbox.push(text);
    },
  };
}

describe("processTick end-to-end (DB tes, pengirim stub)", () => {
  beforeEach(async () => {
    await cleanTestDb();
  });

  it("kirim sekali lalu idempoten pada tick kedua", async () => {
    const userId = await createTestUser();
    // Senin 2026-10-12 07:30 WIB, 25 menit Dicoding.
    await db.studySession.create({
      data: {
        userId,
        track: "DICODING",
        startedAt: new Date("2026-10-12T00:30:00.000Z"),
        endedAt: new Date("2026-10-12T00:55:00.000Z"),
        durationMin: 25,
        plannedFocusMin: 25,
      },
    });

    const inbox: string[] = [];
    // 08:05 WIB = dalam jendela STUDY_START.
    const first = await processTick(new Date("2026-10-12T01:05:00.000Z"), stubSender(inbox));
    expect(first).toMatchObject({ due: 1, sent: 1, failed: 0 });
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toContain("Dicoding 25/60");

    const second = await processTick(new Date("2026-10-12T01:06:00.000Z"), stubSender(inbox));
    expect(second.sent).toBe(0);
    expect(inbox).toHaveLength(1);
  });

  it("kirim gagal ditandai FAILED dan dicoba lagi", async () => {
    await createTestUser();
    const failing: TickSender = {
      sendMessage: async (): Promise<void> => {
        throw new Error("jaringan putus");
      },
    };
    const first = await processTick(new Date("2026-10-12T01:05:00.000Z"), failing);
    expect(first).toMatchObject({ due: 1, sent: 0, failed: 1 });

    const inbox: string[] = [];
    const retry = await processTick(new Date("2026-10-12T01:06:00.000Z"), stubSender(inbox));
    expect(retry.sent).toBe(1);
    expect(inbox).toHaveLength(1);
  });
});
