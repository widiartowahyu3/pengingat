// Seed user tunggal. Password diminta lewat terminal (hidden input) dan
// TIDAK PERNAH disimpan di file apapun. userId dibuat acak (cuid).
import "dotenv/config";
import readline from "node:readline";
import * as argon2 from "argon2";
import { guardRemoteDatabase } from "../lib/prisma-guard";
import { env } from "../lib/env";
import { db } from "../lib/db";

void env; // fail-fast bila env kurang (lib/env throw saat import)

// Pengaman: seed ke database non-lokal hanya dengan ALLOW_REMOTE_DB=1.
guardRemoteDatabase(process.env.DATABASE_URL ?? "");

const MIN_PASSWORD_LENGTH = 14;
const DEFAULT_TARGET_MINUTES = 60; // asumsi Fase 0: 60 mnt per jalur

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    // Matikan echo agar password tidak tampil di terminal.
    const writable = rl as unknown as { _writeToOutput(s: string): void };
    writable._writeToOutput = () => {};
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function readPipedLines(): Promise<string[]> {
  let data = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data.split(/\r?\n/);
}

async function main(): Promise<void> {
  const existing = await db.user.findFirst({ select: { id: true } });
  if (existing !== null) {
    console.error("User sudah ada. Hapus manual di database bila ingin reset total.");
    process.exit(1);
  }

  let password: string;
  let confirm: string;
  if (process.stdin.isTTY) {
    password = await promptHidden("Password login (min 14 karakter): ");
    confirm = await promptHidden("Ulangi password: ");
  } else {
    // Mode pipe (otomasi/tes): dua baris pertama = password + konfirmasi.
    // Di terminal asli tetap hidden (cabang di atas).
    const lines = await readPipedLines();
    password = lines[0] ?? "";
    confirm = lines[1] ?? "";
  }
  if (password !== confirm) {
    console.error("Password tidak sama.");
    process.exit(1);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Password minimal ${MIN_PASSWORD_LENGTH} karakter.`);
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await db.user.create({
    data: {
      passwordHash,
      targets: {
        create: [
          { track: "DICODING", minutesPerDay: DEFAULT_TARGET_MINUTES },
          { track: "CLINFORM", minutesPerDay: DEFAULT_TARGET_MINUTES },
        ],
      },
      setting: { create: {} },
    },
    select: { id: true, createdAt: true },
  });

  // Log hanya metadata, bukan secret.
  console.log(`User dibuat: id=${user.id} createdAt=${user.createdAt.toISOString()}`);
  await db.$disconnect();
}

void main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : "seed gagal");
  void db.$disconnect();
  process.exit(1);
});
