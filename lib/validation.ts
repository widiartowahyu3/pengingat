import { z } from "zod";
import { LOCATION_PRESET_KEYS } from "./locations";

// Skema validasi input (server + bot). Batas aman sesuai aturan main.

export const hhMmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "format jam harus HH:MM (00:00-23:59)");

/** Hari aktif: angka hari ala JS (0=Minggu..6=Sabtu). */
export const activeDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .max(7)
  .refine((days) => new Set(days).size === days.length, {
    message: "activeDays tidak boleh duplikat",
  });

export const locationKeySchema = z
  .string()
  .regex(/^[a-z0-9_]{1,32}$/, "kunci lokasi tidak valid")
  .refine((k) => (LOCATION_PRESET_KEYS as readonly string[]).includes(k), {
    message: "kunci preset tidak dikenal",
  });

export const latitudeSchema = z
  .number()
  .finite("lintang harus angka berhingga")
  .min(-90, "lintang minimal -90")
  .max(90, "lintang maksimal 90");

export const longitudeSchema = z
  .number()
  .finite("bujur harus angka berhingga")
  .min(-180, "bujur minimal -180")
  .max(180, "bujur maksimal 180");

export const trackSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(z.enum(["DICODING", "CLINFORM"]));

export const noteSchema = z.string().trim().max(280, "catatan maksimal 280 karakter");

/** Bulatkan koordinat kiriman user ke 2 desimal (~1,1 km). */
export function roundCoord(n: number): number {
  return Math.round(n * 100) / 100;
}
