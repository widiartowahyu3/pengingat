import { Bot } from "grammy";

// Satu factory agar polling dan webhook memakai konfigurasi bot yang sama.
export function createBot(token: string): Bot {
  return new Bot(token);
}
