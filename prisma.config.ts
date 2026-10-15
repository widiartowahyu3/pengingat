import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // Dev-only: database bayangan untuk `prisma migrate diff`. Di Neon/prod,
    // diff tidak dijalankan dari aplikasi; hanya dari mesin dev.
    shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
});
