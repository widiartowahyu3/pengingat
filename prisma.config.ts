import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolveCliDatabaseUrl } from "./lib/prisma-guard";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI (migrate/generate/studio): DIRECT_URL bila diisi, fallback
    // DATABASE_URL. Diblokir untuk host non-lokal kecuali ALLOW_REMOTE_DB=1.
    // Runtime TIDAK lewat sini (pakai adapter + DATABASE_URL di lib/db.ts).
    url: resolveCliDatabaseUrl(),
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
