/*
  Warnings:

  - You are about to drop the column `lastReminderSentOn` on the `UserSetting` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('CLAIMED', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "UserSetting" DROP COLUMN "lastReminderSentOn",
ADD COLUMN     "activeDays" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
ADD COLUMN     "dayEndWib" VARCHAR(5) NOT NULL DEFAULT '16:00',
ADD COLUMN     "fridayPrayerBreakMin" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "locationKey" VARCHAR(32),
ADD COLUMN     "locationLat" DOUBLE PRECISION,
ADD COLUMN     "locationLon" DOUBLE PRECISION,
ADD COLUMN     "prayerBreakMin" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "studyStartWib" VARCHAR(5) NOT NULL DEFAULT '08:00';

-- CreateTable
CREATE TABLE "ReminderEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" VARCHAR(10) NOT NULL,
    "eventKey" VARCHAR(32) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'CLAIMED',
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceState" (
    "key" VARCHAR(32) NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceState_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "ReminderEvent_status_createdAt_idx" ON "ReminderEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderEvent_userId_localDate_eventKey_key" ON "ReminderEvent"("userId", "localDate", "eventKey");

-- AddForeignKey
ALTER TABLE "ReminderEvent" ADD CONSTRAINT "ReminderEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
