import { afterEach, describe, expect, it, vi } from "vitest";

// Kenapa: env validation adalah gerbang keamanan (fail-fast). Tes ini
// memastikan kunci yang hilang/lemah terdeteksi DENGAN nama key,
// TANPA membocorkan nilai secret ke pesan error/log.

const VALID = {
  DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/db",
  SESSION_SECRET: "s".repeat(32),
  TELEGRAM_BOT_TOKEN: "123456:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  TELEGRAM_WEBHOOK_SECRET: "w".repeat(16),
  TELEGRAM_ALLOWED_CHAT_IDS: "111,222",
  CRON_SECRET: "c".repeat(16),
} as const;

afterEach(() => {
  vi.resetModules();
});

describe("env validation", () => {
  it("menerima env valid dan parse allowlist + TRUST_PROXY", async () => {
    Object.assign(process.env, VALID);
    const { env } = await import("../lib/env");
    expect(env.TELEGRAM_ALLOWED_CHAT_IDS).toEqual([111, 222]);
    expect(env.TRUST_PROXY).toBe(false);
  });

  it("menolak DATABASE_URL non-postgres, pesan hanya berisi nama key", async () => {
    Object.assign(process.env, { ...VALID, DATABASE_URL: "mysql://RAHASIA" });
    const err = await import("../lib/env").then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).toMatch(/DATABASE_URL/);
    expect(msg).not.toMatch(/RAHASIA/);
  });

  it("menolak SESSION_SECRET pendek", async () => {
    Object.assign(process.env, { ...VALID, SESSION_SECRET: "pendek" });
    await expect(import("../lib/env")).rejects.toThrow(/SESSION_SECRET/);
  });
});
