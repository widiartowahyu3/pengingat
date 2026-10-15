// Utilitas webhook Telegram yang aman: token dibaca dari env dan
// TIDAK PERNAH dicetak ke output (termasuk saat error).
// Pakai: npx tsx scripts/telegram-webhook.ts [set|delete|info]
//
// - set: daftarkan APP_BASE_URL/api/telegram/webhook (+secret header).
// - delete: hapus webhook (wajib sebelum polling lokal memakai token yang sama).
// - info: tampilkan status webhook tanpa token.
//
// Aturan dua bot: token dev dan prod BERBEDA (dua bot di BotFather).
// Polling dan webhook tidak boleh aktif bersamaan untuk satu token:
// jalankan `delete` dulu sebelum `npm run bot`, dan hentikan bot lokal
// sebelum `set` untuk produksi.
import "dotenv/config";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function baseUrl(): string {
  const raw = process.env.APP_BASE_URL;
  if (raw === undefined || raw === "") fail("APP_BASE_URL belum diisi di env.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail("APP_BASE_URL bukan URL valid.");
  }
  if (url.protocol !== "https:") fail("APP_BASE_URL harus https.");
  return url.toString().replace(/\/$/, "");
}

async function callApi(
  token: string,
  method: string,
  params: Record<string, unknown>,
): Promise<{ ok: boolean; description?: string }> {
  // Token hanya hidup di URL request, tidak pernah di-log.
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) fail(`Telegram API HTTP ${res.status}.`);
  const body = (await res.json()) as { ok: boolean; description?: string };
  return body;
}

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token === undefined || token === "") fail("TELEGRAM_BOT_TOKEN belum diisi di env.");
  const cmd = process.argv[2];
  if (cmd === "set") {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret === undefined || secret === "") fail("TELEGRAM_WEBHOOK_SECRET belum diisi di env.");
    const url = `${baseUrl()}/api/telegram/webhook`;
    const res = await callApi(token, "setWebhook", {
      url,
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    });
    console.log(`setWebhook ok=${res.ok} url=${url}`);
  } else if (cmd === "delete") {
    const res = await callApi(token, "deleteWebhook", { drop_pending_updates: true });
    console.log(`deleteWebhook ok=${res.ok}`);
  } else if (cmd === "info") {
    const res = (await callApi(token, "getWebhookInfo", {})) as {
      ok: boolean;
      result?: { url?: string; pending_update_count?: number };
    };
    console.log(
      `webhook url=${res.result?.url ?? "-"} pending=${res.result?.pending_update_count ?? "-"}`,
    );
  } else {
    fail("pakai: npx tsx scripts/telegram-webhook.ts [set|delete|info]");
  }
}

void main().catch(() => fail("perintah gagal (detail disembunyikan agar token aman)."));
