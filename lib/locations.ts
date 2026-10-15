// Preset lokasi untuk waktu sholat. Koordinat terverifikasi 2026-10-11:
// - yogyakarta: Wikipedia "Yogyakarta" (7°48′5″S 110°21′52″E) dan GeoNames
//   ID 1621175 (-7.80, 110.375). Estimasi awal (-7.797, 110.370) meleset
//   <1 km — tidak material untuk waktu sholat (selisih orde detik).
// - karanganyar: Wikipedia "Karanganyar Regency" (7°35′46″S 110°57′3″E).
//   Estimasi awal (-7.598, 110.949) meleset ~0,3 km — tidak material.
// Nilai dipakai apa adanya; presisi lebih tinggi tidak mengubah menit hasil.

export interface LocationPreset {
  key: string;
  name: string;
  lat: number;
  lon: number;
}

export const LOCATION_PRESETS = {
  yogyakarta: { key: "yogyakarta", name: "Yogyakarta", lat: -7.80139, lon: 110.36444 },
  karanganyar: { key: "karanganyar", name: "Karanganyar", lat: -7.59611, lon: 110.95083 },
} as const satisfies Record<string, LocationPreset>;

export type LocationKey = keyof typeof LOCATION_PRESETS;

export const LOCATION_PRESET_KEYS = Object.keys(LOCATION_PRESETS) as LocationKey[];

export function getPreset(key: string): LocationPreset | null {
  const found: LocationPreset | undefined = LOCATION_PRESETS[key as LocationKey];
  return found ?? null;
}
