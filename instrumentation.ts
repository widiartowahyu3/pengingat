export async function register(): Promise<void> {
  // Fail-fast: validasi env saat server mulai. Throw di sini menggagalkan boot
  // dengan pesan berisi NAMA key saja (tanpa nilai secret).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/env");
  }
}
