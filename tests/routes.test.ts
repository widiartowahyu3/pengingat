import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
});

function post(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method: "POST", headers });
}

describe("POST /api/cron/reminder", () => {
  it("tanpa Bearer -> 401 tanpa menyentuh DB", async () => {
    const { POST } = await import("../app/api/cron/reminder/route");
    const res = await POST(post("/api/cron/reminder"));
    expect(res.status).toBe(401);
  });

  it("Bearer salah -> 401", async () => {
    const { POST } = await import("../app/api/cron/reminder/route");
    const res = await POST(post("/api/cron/reminder", { authorization: "Bearer salah" }));
    expect(res.status).toBe(401);
  });

  it("gerbang jam aktif: di luar jam -> skipped sebelum query DB", async () => {
    const { isWithinActiveHours } = await import("../lib/reminder");
    const { POST } = await import("../app/api/cron/reminder/route");
    const secret = "c".repeat(16); // sama dengan setup.ts
    const before = new Date();
    const res = await POST(post("/api/cron/reminder", { authorization: `Bearer ${secret}` }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; skipped?: boolean };
    if (!isWithinActiveHours(before)) {
      // Keluar sebelum query DB: DB tes boleh kosong/rusak, tetap 200.
      expect(body).toMatchObject({ ok: true, skipped: true });
    } else {
      expect(body.ok).toBe(true);
    }
  });

  it("tidak mengekspor GET (405/404 oleh runtime Next)", async () => {
    const mod = (await import("../app/api/cron/reminder/route")) as unknown as Record<
      string,
      unknown
    >;
    expect(mod["GET"]).toBeUndefined();
  });
});

describe("POST /api/telegram/webhook", () => {
  it("mode polling -> 404 (route nonaktif)", async () => {
    const { POST } = await import("../app/api/telegram/webhook/route");
    const res = await POST(post("/api/telegram/webhook"));
    expect(res.status).toBe(404);
  });

  it("mode webhook tanpa secret -> 401", async () => {
    const prev = process.env.BOT_MODE;
    process.env.BOT_MODE = "webhook";
    vi.resetModules();
    try {
      const { POST } = await import("../app/api/telegram/webhook/route");
      const res = await POST(post("/api/telegram/webhook"));
      expect(res.status).toBe(401);
    } finally {
      if (prev === undefined) delete process.env.BOT_MODE;
      else process.env.BOT_MODE = prev;
      vi.resetModules();
    }
  });
});
