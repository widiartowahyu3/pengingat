import { describe, expect, it } from "vitest";
import { LOCATION_PRESETS } from "../lib/locations";
import { resolveTickLocation } from "../lib/reminder";
import { latitudeSchema, locationKeySchema, longitudeSchema, roundCoord } from "../lib/validation";

describe("resolveTickLocation", () => {
  it("preset mengembalikan koordinat terverifikasi + nama", () => {
    const loc = resolveTickLocation(
      { locationKey: "yogyakarta", locationLat: null, locationLon: null },
      "yogyakarta",
    );
    expect(loc).toEqual({ lat: -7.80139, lon: 110.36444, label: "Yogyakarta" });
  });

  it("kunci tak dikenal + koordinat manual -> lokasi kiriman", () => {
    const loc = resolveTickLocation(
      { locationKey: "tidak-ada", locationLat: -7.6, locationLon: 110.95 },
      "yogyakarta",
    );
    expect(loc.label).toBe("lokasi kiriman");
  });

  it("tanpa pilihan memakai preset default", () => {
    const loc = resolveTickLocation(
      { locationKey: null, locationLat: null, locationLon: null },
      "karanganyar",
    );
    expect(loc.label).toBe("Karanganyar");
    expect(LOCATION_PRESETS.karanganyar.lat).toBe(-7.59611);
  });
});

describe("validasi koordinat", () => {
  it("lintang di luar [-90, 90] ditolak", () => {
    expect(latitudeSchema.safeParse(91).success).toBe(false);
    expect(latitudeSchema.safeParse(-91).success).toBe(false);
    expect(latitudeSchema.safeParse(Number.NaN).success).toBe(false);
    expect(latitudeSchema.safeParse(-7.8).success).toBe(true);
  });

  it("bujur di luar [-180, 180] ditolak", () => {
    expect(longitudeSchema.safeParse(181).success).toBe(false);
    expect(longitudeSchema.safeParse(110.36).success).toBe(true);
  });

  it("pembulatan 2 desimal benar", () => {
    expect(roundCoord(110.36444)).toBe(110.36);
    expect(roundCoord(-7.80139)).toBe(-7.8);
  });

  it("kunci preset tidak valid ditolak", () => {
    expect(locationKeySchema.safeParse("yogyakarta").success).toBe(true);
    expect(locationKeySchema.safeParse("tidak-ada").success).toBe(false);
    expect(locationKeySchema.safeParse("YO GYA").success).toBe(false);
  });
});

describe("parseMulaiArgs", () => {
  it("kasus valid dan tidak valid", async () => {
    const { parseMulaiArgs } = await import("../bot/commands");
    expect(parseMulaiArgs("/mulai dicoding 25")).toEqual({
      ok: true,
      track: "DICODING",
      minutes: 25,
    });
    expect(parseMulaiArgs("/mulai CLINFORM")).toEqual({
      ok: true,
      track: "CLINFORM",
      minutes: null,
    });
    expect(parseMulaiArgs("/mulai salah")).toEqual({ ok: false });
    expect(parseMulaiArgs("/mulai dicoding 0")).toEqual({ ok: false });
    expect(parseMulaiArgs("/mulai dicoding 200")).toEqual({ ok: false });
    expect(parseMulaiArgs("/mulai")).toEqual({ ok: false });
  });
});
