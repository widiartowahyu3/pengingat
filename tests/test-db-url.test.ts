import { describe, expect, it } from "vitest";
import {
  assertTestDatabaseUrl,
  buildTestDatabaseUrl,
  testDatabaseUrl,
} from "./helpers/test-db-url";

const BASE = { user: "study", password: "s3cr3t", port: 5435 };

describe("buildTestDatabaseUrl", () => {
  it("host non-lokal ditolak; pesan hanya host + nama db", () => {
    let message = "";
    try {
      buildTestDatabaseUrl({ ...BASE, host: "db.prod.example.com", database: "x_test" });
    } catch (err: unknown) {
      message = err instanceof Error ? err.message : "";
    }
    expect(message).toContain("db.prod.example.com");
    expect(message).toContain("x_test");
    expect(message).not.toContain("s3cr3t");
  });

  it("nama tanpa akhiran _test ditolak", () => {
    expect(() =>
      buildTestDatabaseUrl({ ...BASE, host: "127.0.0.1", database: "study_timer" }),
    ).toThrow(/_test/);
  });

  it("ALLOW_REMOTE_DB tidak bisa melewati penolakan", () => {
    process.env.ALLOW_REMOTE_DB = "1";
    try {
      expect(() =>
        buildTestDatabaseUrl({ ...BASE, host: "db.prod.example.com", database: "x_test" }),
      ).toThrow();
    } finally {
      delete process.env.ALLOW_REMOTE_DB;
    }
  });

  it("kombinasi valid lolos", () => {
    expect(buildTestDatabaseUrl({ ...BASE, host: "127.0.0.1", database: "study_timer_test" })).toBe(
      "postgresql://study:s3cr3t@127.0.0.1:5435/study_timer_test",
    );
    expect(buildTestDatabaseUrl({ ...BASE, host: "[::1]", database: "a_test" })).toContain("[::1]");
  });
});

describe("assertTestDatabaseUrl", () => {
  const expected = "postgresql://study:s3cr3t@127.0.0.1:5435/study_timer_test";

  it("kosong/undefined/cocok -> lolos; beda -> berhenti", () => {
    expect(() => assertTestDatabaseUrl(undefined, expected)).not.toThrow();
    expect(() => assertTestDatabaseUrl("", expected)).not.toThrow();
    expect(() => assertTestDatabaseUrl(expected, expected)).not.toThrow();
    expect(() =>
      assertTestDatabaseUrl("postgresql://study:s3cr3t@127.0.0.1:5435/study_timer", expected),
    ).toThrow(/berhenti sebelum menyentuh data/);
  });
});

describe("testDatabaseUrl", () => {
  it("berakhiran _test dan menunjuk loopback", () => {
    const url = testDatabaseUrl();
    expect(url).toContain("study_timer_test");
    expect(url).toContain("127.0.0.1");
  });
});
