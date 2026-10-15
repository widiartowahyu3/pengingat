import { afterEach, describe, expect, it } from "vitest";
import {
  classifyPrismaCommand,
  guardRemoteDatabase,
  resolveCliDatabaseUrl,
} from "../lib/prisma-guard";

const LOCAL = "postgresql://study:study@127.0.0.1:5435/study_timer";
const REMOTE =
  "postgresql://u:rahasia@ep-abc-123-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require";

function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function expectDenyRemote(fn: () => void): void {
  let message = "";
  try {
    fn();
  } catch (err: unknown) {
    message = err instanceof Error ? err.message : "";
  }
  expect(message).toContain("ep-abc-123-pooler.ap-southeast-1.aws.neon.tech");
  expect(message).not.toContain("rahasia");
}

const BIN = ["node", "prisma"];

afterEach(() => {
  delete process.env.ALLOW_REMOTE_DB;
});

describe("classifyPrismaCommand", () => {
  it("tanpa DB: generate, validate, format, help, version", () => {
    for (const argv of [
      [...BIN, "generate"],
      [...BIN, "validate"],
      [...BIN, "format"],
      [...BIN, "--help"],
      [...BIN, "migrate", "--help"],
      [...BIN, "--version"],
    ]) {
      expect(classifyPrismaCommand(argv)).toBe("no-db");
    }
  });

  it("flag sebelum/di antara subperintah tidak mengecoh", () => {
    expect(classifyPrismaCommand([...BIN, "--schema=x", "migrate", "reset"])).toBe("never-remote");
    expect(classifyPrismaCommand([...BIN, "migrate", "--schema=x", "dev"])).toBe("never-remote");
    expect(classifyPrismaCommand([...BIN, "--schema=x", "generate"])).toBe("no-db");
    expect(classifyPrismaCommand([...BIN, "migrate", "deploy", "--schema=x"])).toBe("needs-flag");
  });

  it('kata "reset"/"push" di posisi mana pun -> never-remote', () => {
    expect(classifyPrismaCommand([...BIN, "migrate", "diff", "reset"])).toBe("never-remote");
    expect(classifyPrismaCommand([...BIN, "db", "seed", "push"])).toBe("never-remote");
  });

  it("tak boleh remote walau ber-flag: reset, push, dev, execute", () => {
    for (const argv of [
      [...BIN, "migrate", "reset"],
      [...BIN, "db", "push"],
      [...BIN, "migrate", "dev"],
      [...BIN, "db", "execute"],
    ]) {
      expect(classifyPrismaCommand(argv)).toBe("never-remote");
    }
  });

  it("butuh flag: deploy, status, resolve, diff, pull, seed, studio, tak dikenal", () => {
    for (const argv of [
      [...BIN, "migrate", "deploy"],
      [...BIN, "migrate", "status"],
      [...BIN, "migrate", "resolve"],
      [...BIN, "migrate", "diff"],
      [...BIN, "db", "pull"],
      [...BIN, "db", "seed"],
      [...BIN, "studio"],
      [...BIN, "perintah-asing"],
    ]) {
      expect(classifyPrismaCommand(argv)).toBe("needs-flag");
    }
  });
});

describe("resolveCliDatabaseUrl", () => {
  it("generate lolos tanpa flag dengan URL remote", () => {
    withEnv({ DIRECT_URL: undefined, DATABASE_URL: REMOTE, ALLOW_REMOTE_DB: undefined }, () => {
      expect(resolveCliDatabaseUrl([...BIN, "generate"])).toBe(REMOTE);
    });
  });

  it("migrate dev non-lokal ditolak walau ber-flag", () => {
    withEnv({ DIRECT_URL: REMOTE, DATABASE_URL: LOCAL, ALLOW_REMOTE_DB: "1" }, () => {
      expectDenyRemote(() => resolveCliDatabaseUrl([...BIN, "migrate", "dev"]));
    });
  });

  it("db execute non-lokal ditolak walau ber-flag", () => {
    withEnv({ DIRECT_URL: REMOTE, DATABASE_URL: LOCAL, ALLOW_REMOTE_DB: "1" }, () => {
      expectDenyRemote(() => resolveCliDatabaseUrl([...BIN, "db", "execute"]));
    });
  });

  it("migrate deploy remote hanya dengan flag inline", () => {
    withEnv({ DIRECT_URL: REMOTE, DATABASE_URL: LOCAL, ALLOW_REMOTE_DB: undefined }, () => {
      expectDenyRemote(() => resolveCliDatabaseUrl([...BIN, "migrate", "deploy"]));
    });
    withEnv({ DIRECT_URL: REMOTE, DATABASE_URL: LOCAL, ALLOW_REMOTE_DB: "1" }, () => {
      expect(resolveCliDatabaseUrl([...BIN, "migrate", "deploy"])).toBe(REMOTE);
    });
  });

  it("migrate reset dan db push ditolak walau ber-flag", () => {
    withEnv({ DIRECT_URL: REMOTE, DATABASE_URL: LOCAL, ALLOW_REMOTE_DB: "1" }, () => {
      expectDenyRemote(() => resolveCliDatabaseUrl([...BIN, "migrate", "reset"]));
      expectDenyRemote(() => resolveCliDatabaseUrl([...BIN, "db", "push"]));
    });
  });

  it("DIRECT_URL diutamakan; fallback DATABASE_URL lokal", () => {
    withEnv({ DIRECT_URL: REMOTE, DATABASE_URL: LOCAL, ALLOW_REMOTE_DB: "1" }, () => {
      expect(resolveCliDatabaseUrl([...BIN, "migrate", "deploy"])).toBe(REMOTE);
    });
    withEnv({ DIRECT_URL: undefined, DATABASE_URL: LOCAL, ALLOW_REMOTE_DB: undefined }, () => {
      expect(resolveCliDatabaseUrl([...BIN, "migrate", "deploy"])).toBe(LOCAL);
    });
  });
});

describe("loopback eksplisit", () => {
  it("localhost, 127.0.0.1, [::1] lolos", () => {
    expect(() => guardRemoteDatabase(LOCAL)).not.toThrow();
    expect(() => guardRemoteDatabase("postgresql://u:p@localhost:5432/db")).not.toThrow();
    expect(() => guardRemoteDatabase("postgresql://u:p@[::1]:5432/db")).not.toThrow();
  });

  it("menyerupai loopback tetapi bukan -> ditolak", () => {
    for (const url of [
      "postgresql://u:p@localhost.evil.com:5432/db",
      "postgresql://u:p@127.0.0.1.evil.com:5432/db",
      // 127.0.0.2 SENGAJA tidak dibuka: allowlist eksplisit (fail-closed).
      // Dev/prod memakai 127.0.0.1; bila butuh, tambah eksplisit + alasan.
      "postgresql://u:p@127.0.0.2:5432/db",
    ]) {
      let threw = false;
      try {
        guardRemoteDatabase(url);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    }
  });
});

describe("guardRemoteDatabase (seed)", () => {
  it("lokal lolos; remote butuh flag; pesan hanya host", () => {
    expect(() => guardRemoteDatabase(LOCAL)).not.toThrow();
    expectDenyRemote(() => guardRemoteDatabase(REMOTE));
    withEnv({ ALLOW_REMOTE_DB: "1" }, () => {
      expect(() => guardRemoteDatabase(REMOTE)).not.toThrow();
    });
  });
});
