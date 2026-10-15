import { Prisma } from "@prisma/client";
import { db } from "../lib/db";
import { CLAIM_RETRY_AFTER_MINUTES } from "../lib/reminder";

export type ClaimOutcome = "claimed" | "already-sent" | "claimed-by-other";

interface StoredClaim {
  id: string;
  status: "CLAIMED" | "SENT" | "FAILED";
  claimedAt: Date;
}

function isRecordNotFound(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === "P2002" || err.code === "P2025")
  );
}

/**
 * Klaim event secara atomik. Aturan (sesuai keputusan):
 * - Belum ada baris -> INSERT CLAIMED, pemenang tunggal.
 * - SENT -> "already-sent", tidak pernah diklaim ulang.
 * - FAILED, atau CLAIMED lebih lama dari 2 menit (pemilik lama mati),
 *   -> UPDATE bersyarat atomik (cek status+claimedAt lama); menang bila
 *   tepat 1 baris terpengaruh, kalau tidak berarti tick lain menang.
 */
export async function tryClaimEvent(
  userId: string,
  localDate: string,
  eventKey: string,
  now: Date,
): Promise<{ outcome: ClaimOutcome; id: string | null }> {
  try {
    const row = await db.reminderEvent.create({
      data: { userId, localDate, eventKey, status: "CLAIMED", claimedAt: now, attempts: 1 },
      select: { id: true },
    });
    return { outcome: "claimed", id: row.id };
  } catch (err: unknown) {
    if (!isRecordNotFound(err)) throw err;
  }

  const row: StoredClaim | null = await db.reminderEvent.findUnique({
    where: { userId_localDate_eventKey: { userId, localDate, eventKey } },
    select: { id: true, status: true, claimedAt: true },
  });
  if (row === null) {
    // Balapan sempit: baris hilang di antara konflik dan baca. Anggap kalah.
    return { outcome: "claimed-by-other", id: null };
  }
  if (row.status === "SENT") {
    return { outcome: "already-sent", id: row.id };
  }
  const stale =
    row.status === "FAILED" ||
    now.getTime() - row.claimedAt.getTime() > CLAIM_RETRY_AFTER_MINUTES * 60000;
  if (!stale) {
    return { outcome: "claimed-by-other", id: row.id };
  }
  const updated = await db.reminderEvent.updateMany({
    where: { id: row.id, status: row.status, claimedAt: row.claimedAt },
    data: { status: "CLAIMED", claimedAt: now, attempts: { increment: 1 } },
  });
  if (updated.count === 1) {
    return { outcome: "claimed", id: row.id };
  }
  return { outcome: "claimed-by-other", id: row.id };
}

export async function markEventSent(id: string): Promise<void> {
  await db.reminderEvent.update({ where: { id }, data: { status: "SENT" } });
}

export async function markEventFailed(id: string): Promise<void> {
  await db.reminderEvent.update({ where: { id }, data: { status: "FAILED" } });
}
