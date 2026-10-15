import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Kenapa adapter eksplisit: Prisma 7 mewajibkan driver adapter; sekaligus
// memastikan DATABASE_URL tervalidasi (fail-fast) setiap koneksi DB dibuat.
// Kenapa singleton: hot-reload di dev membuat banyak instance PrismaClient
// yang menghabiskan koneksi Postgres bila dibuat per import.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
