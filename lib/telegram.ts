import type { TickSender } from "../services/reminderService";

// Pengirim Telegram dengan timeout pendek (batas waktu fungsi Hobby).
// Token tidak pernah ditulis ke log/error di sini.
export function createTickSender(
  chatIds: number[],
  send: (chatId: number, text: string) => Promise<void>,
  timeoutMs = 8000,
): TickSender {
  return {
    sendMessage: async (text: string): Promise<void> => {
      const sends = chatIds.map((chatId) =>
        withTimeout(send(chatId, text), timeoutMs, "Telegram timeout"),
      );
      await Promise.all(sends);
    },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
