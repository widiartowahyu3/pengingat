import { NextRequest, NextResponse } from "next/server";
import { createBot } from "@/bot/client";
import { registerCommands } from "@/bot/commands";
import { secretsEqual } from "@/bot/security";
import { env } from "@/lib/env";
import { isWithinActiveHours } from "@/lib/reminder";
import { createTickSender } from "@/lib/telegram";
import { runCleanup } from "@/services/cleanupService";
import { processTick } from "@/services/reminderService";

// Penegas di bawah batas 300 dtk Hobby (sumber: vercel.com/docs/functions/limitations)
// dan timeout 30 dtk cron-job.org (sumber: cron-job.org/en/faq).
// Anggaran tick: <25 dtk termasuk bangun Neon + timeout Telegram 8 dtk.
export const maxDuration = 60;

let sharedBot: ReturnType<typeof createBot> | null = null;
function getBot(): ReturnType<typeof createBot> {
  if (sharedBot === null) {
    sharedBot = createBot(env.TELEGRAM_BOT_TOKEN);
    registerCommands(sharedBot);
  }
  return sharedBot;
}

/**
 * Endpoint cron (dipanggil scheduler eksternal tiap 5 menit).
 * POST saja + Bearer CRON_SECRET (constant-time). Tanpa input pengguna.
 * Respons hanya hitungan, tanpa data pribadi.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const provided = req.headers.get("authorization") ?? "";
  if (!secretsEqual(provided, `Bearer ${env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  // Gerbang hemat CU: di luar 07:55-16:30 WIB keluar SEBELUM query DB apa pun.
  // Cleanup ikut di dalam rentang (tidak jalan di luar jam).
  if (!isWithinActiveHours(now)) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  const sender = createTickSender(env.TELEGRAM_ALLOWED_CHAT_IDS, (chatId, text) =>
    getBot()
      .api.sendMessage(chatId, text)
      .then(() => undefined),
  );
  const summary = await processTick(now, sender);
  const cleanup = await runCleanup(now);
  return NextResponse.json({
    ok: true,
    due: summary.due,
    sent: summary.sent,
    failed: summary.failed,
    cleanupRan: cleanup.ran,
  });
}
