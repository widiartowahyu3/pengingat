import { afterEach, describe, expect, it } from "vitest";
import { guardRemoteDatabase, resolveCliDatabaseUrl } from "../lib/prisma-guard";

const LOCAL = "postgresql://study:study@127.0.0.1:5435/study_timer";
const REMOTE = "postgresql://u:p@ep-abc-123-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require";

function withEnv(key: string, value: string | undefined, fn: () => void): void {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

afterEach(() => {
  delete process.env.ALLOW_REMOTE_DB;
  delete process.env.DIRECT_URL;
});

describe("guardRemoteDatabase", () => {
  it("loopback lolos tanpa flag", () => {
    expect(() => guardRemoteDatabase(LOCAL)).not.toThrow();
    expect(() => guardRemoteDatabase("postgresql://u:p@localhost:5432/db")).not.toThrow();
  });

  it("non-lokal tanpa flag ditolak cepat, pesan hanya berisi host", () => {
    let message = "";
    try {
      guardRemoteDatabase(REMOTE);
    } catch (err: unknown) {
      message = err instanceof Error ? err.message : "";
    }
    expect(message).toContain("ep-abc-123-pooler.ap-southeast-1.aws.neon.tech");
    expect(message).not.toContain("u:p");
    expect(message).not.toContain("p@");
  });

  it("non-lokal dengan ALLOW_REMOTE_DB=1 diizinkan", () => {
    withEnv("ALLOW_REMOTE_DB", "1", () => {
      expect(() => guardRemoteDatabase(REMOTE)).not.toThrow();
    });
  });

  it("URL rusak ditolak", () => {
    expect(() => guardRemoteDatabase("bukan-url")).toThrow(/tidak valid/);
  });
});

describe("resolveCliDatabaseUrl", () => {
  it("DIRECT_URL diutamakan, fallback DATABASE_URL", () => {
    withEnv("DIRECT_URL", REMOTE, () => {
      withEnv("ALLOW_REMOTE_DB", "1", () => {
        withEnv("DATABASE_URL", LOCAL, () => {
          expect(resolveCliDatabaseUrl()).toBe(REMOTE);
        });
      });
    });
    withEnv("DIRECT_URL", undefined, () => {
      withEnv("DATABASE_URL", LOCAL, () => {
        expect(resolveCliDatabaseUrl()).toBe(LOCAL);
      });
    });
  });
});
