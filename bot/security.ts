import type { Context, NextFunction } from "grammy";
import { timingSafeEqual } from "node:crypto";

// Perbandingan constant-time untuk secret header. Panjang berbeda -> false
// tanpa membandingkan isi (bocor panjang diabaikan: panjang secret BotFather
// dan secret kita bukan rahasia).
export function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Allowlist chat ID: selain itu diabaikan diam-diam (tanpa balasan). */
export function isAllowedChat(chatId: number, allowlist: number[]): boolean {
  return allowlist.includes(chatId);
}

/** Middleware grammy: chat non-allowlist berhenti di sini (tanpa next). */
export function createAllowlistGuard(allowlist: number[]) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    const chatId = ctx.from?.id;
    if (typeof chatId !== "number" || !isAllowedChat(chatId, allowlist)) {
      return;
    }
    await next();
  };
}
