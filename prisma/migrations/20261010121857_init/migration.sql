-- CreateEnum
CREATE TYPE "Track" AS ENUM ('DICODING', 'CLINFORM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveSession" (
    "userId" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "plannedFocusMin" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveSession_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "note" VARCHAR(280),
    "plannedFocusMin" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "minutesPerDay" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSetting" (
    "userId" TEXT NOT NULL,
    "defaultFocusMin" INTEGER NOT NULL DEFAULT 25,
    "defaultBreakMin" INTEGER NOT NULL DEFAULT 5,
    "reminderTimeWib" VARCHAR(5) NOT NULL DEFAULT '07:00',
    "lastReminderSentOn" VARCHAR(10),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSetting_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "WebSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "ipHash" TEXT,
    "userAgentHash" TEXT,

    CONSTRAINT "WebSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramProcessedUpdate" (
    "updateId" BIGINT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramProcessedUpdate_pkey" PRIMARY KEY ("updateId")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudySession_userId_startedAt_idx" ON "StudySession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "StudySession_userId_track_startedAt_idx" ON "StudySession"("userId", "track", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTarget_userId_track_key" ON "DailyTarget"("userId", "track");

-- CreateIndex
CREATE UNIQUE INDEX "WebSession_tokenHash_key" ON "WebSession"("tokenHash");

-- CreateIndex
CREATE INDEX "WebSession_userId_expiresAt_idx" ON "WebSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "TelegramProcessedUpdate_receivedAt_idx" ON "TelegramProcessedUpdate"("receivedAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_ipHash_attemptedAt_idx" ON "LoginAttempt"("ipHash", "attemptedAt");

-- AddForeignKey
ALTER TABLE "ActiveSession" ADD CONSTRAINT "ActiveSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTarget" ADD CONSTRAINT "DailyTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSetting" ADD CONSTRAINT "UserSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebSession" ADD CONSTRAINT "WebSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
