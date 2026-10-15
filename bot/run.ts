// Proses bot lokal (polling): menangani perintah + tick pengingat tiap menit.
// Hanya untuk BOT_MODE=polling. Produksi memakai webhook + endpoint cron.
import "dotenv/config";
import { createBot } from "./client";
import { registerCommands } from "./commands";
import { createTickSender } from "../lib/telegram";
import { env } from "../lib/env";
import { processTick } from "../services/reminderService";

async function main(): Promise<void> {
  if (env.BOT_MODE !== "polling") {
    console.error("BOT_MODE bukan polling, proses bot berhenti.");
    process.exit(1);
  }
  const bot = createBot(env.TELEGRAM_BOT_TOKEN);
  registerCommands(bot);
  const sender = createTickSender(env.TELEGRAM_ALLOWED_CHAT_IDS, (chatId, text) =>
    bot.api.sendMessage(chatId, text).then(() => undefined),
  );

  const tick = async (): Promise<void> => {
    try {
      const s = await processTick(new Date(), sender);
      // Log hanya hitungan, bukan isi pesan.
      console.log(`tick due=${s.due} sent=${s.sent} failed=${s.failed}`);
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : "tick gagal");
    }
  };

  await tick();
  setInterval(() => void tick(), 60_000);
  await bot.start();
}

void main();
