import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { markEventFailed, markEventSent, tryClaimEvent } from "../repositories/reminderRepo";
import { cleanTestDb, createTestUser } from "./helpers/db";

describe("tryClaimEvent (atomik)", () => {
  let userId = "";
  const DATE = "2026-10-12";
  const KEY = "STUDY_START";

  beforeEach(async () => {
    await cleanTestDb();
    userId = await createTestUser();
  });

  it("klaim pertama menang, kedua kalah", async () => {
    const now = new Date();
    const first = await tryClaimEvent(userId, DATE, KEY, now);
    expect(first.outcome).toBe("claimed");
    const second = await tryClaimEvent(userId, DATE, KEY, now);
    expect(second.outcome).toBe("claimed-by-other");
  });

  it("SENT tidak pernah diklaim ulang", async () => {
    const first = await tryClaimEvent(userId, DATE, KEY, new Date());
    expect(first.id).not.toBeNull();
    await markEventSent(first.id as string);
    const again = await tryClaimEvent(userId, DATE, KEY, new Date());
    expect(again.outcome).toBe("already-sent");
  });

  it("FAILED boleh diklaim ulang (retry kirim)", async () => {
    const first = await tryClaimEvent(userId, DATE, KEY, new Date());
    await markEventFailed(first.id as string);
    const retry = await tryClaimEvent(userId, DATE, KEY, new Date());
    expect(retry.outcome).toBe("claimed");
    const row = await db.reminderEvent.findUniqueOrThrow({ where: { id: first.id as string } });
    expect(row.attempts).toBe(2);
  });

  it("CLAIMED basi (>2 mnt, proses mati) boleh diklaim ulang", async () => {
    const first = await tryClaimEvent(userId, DATE, KEY, new Date());
    await db.reminderEvent.update({
      where: { id: first.id as string },
      data: { claimedAt: new Date(Date.now() - 5 * 60000) },
    });
    const retry = await tryClaimEvent(userId, DATE, KEY, new Date());
    expect(retry.outcome).toBe("claimed");
  });

  it("CLAIMED segar tidak bisa direbut", async () => {
    await tryClaimEvent(userId, DATE, KEY, new Date());
    const retry = await tryClaimEvent(userId, DATE, KEY, new Date());
    expect(retry.outcome).toBe("claimed-by-other");
  });

  it("10 tick bersamaan hanya 1 pemenang", async () => {
    const now = new Date();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => tryClaimEvent(userId, DATE, KEY, now)),
    );
    expect(results.filter((r) => r.outcome === "claimed")).toHaveLength(1);
  });
});
