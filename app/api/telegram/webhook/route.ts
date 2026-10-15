import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBot } from "@/bot/client";
import { registerCommands } from "@/bot/commands";
import { secretsEqual } from "@/bot/security";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const updateSchema = z.object({ update_id: z.number().int() }).passthrough();

// Singleton per proses server (registerCommands sekali saja).
let sharedBot: ReturnType<typeof createBot> | null = null;
function getBot(): ReturnType<typeof createBot> {
  if (sharedBot === null) {
    sharedBot = createBot(env.TELEGRAM_BOT_TOKEN);
    registerCommands(sharedBot);
  }
  return sharedBot;
}

function isUniqueConflict(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

/**
 * Webhook Telegram. Hanya aktif saat BOT_MODE=webhook (produksi).
 * - Verifikasi secret header constant-time.
 * - Dedup update_id (duplikat -> 200 tanpa diproses ulang).
 * - Selalu balas 200 cepat dengan body generik.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (env.BOT_MODE !== "webhook") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const provided = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secretsEqual(provided, env.TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    await db.telegramProcessedUpdate.create({
      data: { updateId: BigInt(parsed.data.update_id) },
    });
  } catch (err: unknown) {
    if (isUniqueConflict(err)) {
      return NextResponse.json({ ok: true });
    }
    throw err;
  }

  try {
    // Body sudah tervalidasi update_id; teruskan apa adanya ke grammy.
    await getBot().handleUpdate(
      body as Parameters<ReturnType<typeof createBot>["handleUpdate"]>[0],
    );
  } catch {
    // Pesan statis: detail update tidak boleh masuk log.
    console.error("webhook handler error");
  }
  return NextResponse.json({ ok: true });
}
