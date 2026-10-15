import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Samakan alias @/* tsconfig agar route Next bisa diimpor di tes.
    alias: { "@": import.meta.dirname },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // setupFiles: env dummy valid sebelum import modul apa pun.
    // globalSetup: siapkan database tes terpisah + migrasi (sekali per run).
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // File tes berbagi satu database tes -> nonaktifkan paralelisme antar
    // file agar tidak saling menghapus data (cleanTestDb per file).
    fileParallelism: false,
  },
});
