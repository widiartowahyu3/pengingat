import { NextRequest, NextResponse } from "next/server";
import { createBot } from "@/bot/client";
import { registerCommands } from "@/bot/commands";
import { secretsEqual } from "@/bot/security";
import { env } from "@/lib/env";
import { createTickSender } from "@/lib/telegram";
import { runCleanup } from "@/services/cleanupService";
import { processTick } from "@/services/reminderService";

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
