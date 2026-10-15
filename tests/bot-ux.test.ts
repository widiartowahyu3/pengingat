import { describe, expect, it } from "vitest";
import { createAllowlistGuard } from "../bot/security";

describe("activeLocationLabel", () => {
  it("awal (tanpa preset, tanpa kiriman) -> preset default + (default)", async () => {
    const { activeLocationLabel } = await import("../bot/commands");
    expect(activeLocationLabel(null, "yogyakarta")).toBe("Yogyakarta (default)");
    expect(
      activeLocationLabel(
        { locationKey: null, locationLat: null, locationLon: null },
        "yogyakarta",
      ),
    ).toBe("Yogyakarta (default)");
  });

  it("preset terpilih -> nama preset tanpa embel-embel", async () => {
    const { activeLocationLabel } = await import("../bot/commands");
    expect(
      activeLocationLabel(
        { locationKey: "karanganyar", locationLat: null, locationLon: null },
        "yogyakarta",
      ),
    ).toBe("Karanganyar");
  });

  it("koordinat kiriman -> lokasi kiriman", async () => {
    const { activeLocationLabel } = await import("../bot/commands");
    expect(
      activeLocationLabel(
        { locationKey: null, locationLat: -7.8, locationLon: 110.36 },
        "yogyakarta",
      ),
    ).toBe("lokasi kiriman");
  });
});

describe("unknownCommandReply", () => {
  it("perintah tak dikenal -> daftar perintah", async () => {
    const { unknownCommandReply, HELP_TEXT } = await import("../bot/commands");
    expect(unknownCommandReply("/ngawur")).toBe(HELP_TEXT);
    expect(unknownCommandReply("/start")).toBe(HELP_TEXT);
  });

  it("perintah dikenal dan teks biasa -> null (diam)", async () => {
    const { unknownCommandReply } = await import("../bot/commands");
    expect(unknownCommandReply("/mulai dicoding")).toBeNull();
    expect(unknownCommandReply("/jadwal@namabot")).toBeNull();
    expect(unknownCommandReply("halo")).toBeNull();
    expect(unknownCommandReply("")).toBeNull();
  });
});

describe("createAllowlistGuard", () => {
  it("non-allowlist tidak memanggil next (diam)", async () => {
    const guard = createAllowlistGuard([111]);
    let called = false;
    await guard({ from: { id: 999 } } as never, async () => {
      called = true;
    });
    expect(called).toBe(false);
  });

  it("allowlist memanggil next; tanpa from tidak memanggil", async () => {
    const guard = createAllowlistGuard([111]);
    let called = false;
    await guard({ from: { id: 111 } } as never, async () => {
      called = true;
    });
    expect(called).toBe(true);
    called = false;
    await guard({} as never, async () => {
      called = true;
    });
    expect(called).toBe(false);
  });
});
