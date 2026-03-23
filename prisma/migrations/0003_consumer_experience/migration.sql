ALTER TABLE "Consumer"
ADD COLUMN "preferredName" TEXT,
ADD COLUMN "recoveryFocus" TEXT,
ADD COLUMN "checkInPreference" TEXT;

ALTER TABLE "DailyCheckIn"
ADD COLUMN "checkInDate" TIMESTAMP(3),
ADD COLUMN "stressLevel" INTEGER,
ADD COLUMN "sleepQuality" INTEGER,
ADD COLUMN "motivationLevel" INTEGER,
ADD COLUMN "treatmentAdherence" BOOLEAN,
ADD COLUMN "wantsStaffFollowUp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "difficultMoments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "copingToolsUsed" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "notes" TEXT;

UPDATE "DailyCheckIn"
SET "checkInDate" = date_trunc('day', "createdAt")
WHERE "checkInDate" IS NULL;

ALTER TABLE "DailyCheckIn"
ALTER COLUMN "checkInDate" SET NOT NULL;

CREATE UNIQUE INDEX "DailyCheckIn_consumerId_checkInDate_key" ON "DailyCheckIn"("consumerId", "checkInDate");

ALTER TABLE "JournalEntry"
ADD COLUMN "moodScore" INTEGER,
ADD COLUMN "theme" TEXT,
ADD COLUMN "sharedWithCareTeam" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Goal"
ADD COLUMN "description" TEXT,
ADD COLUMN "category" TEXT,
ADD COLUMN "targetLabel" TEXT;

ALTER TABLE "Routine"
ADD COLUMN "description" TEXT,
ADD COLUMN "category" TEXT,
ADD COLUMN "targetPerWeek" INTEGER,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "RoutineCompletion" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "completionDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoutineCompletion_routineId_completionDate_key" ON "RoutineCompletion"("routineId", "completionDate");

ALTER TABLE "RoutineCompletion"
ADD CONSTRAINT "RoutineCompletion_routineId_fkey"
FOREIGN KEY ("routineId") REFERENCES "Routine"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE TABLE "RecoveryPlan" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "focusAreas" JSONB NOT NULL,
    "copingStrategies" JSONB NOT NULL,
    "reminders" JSONB NOT NULL,
    "supportContacts" JSONB NOT NULL,
    "safetyPlan" JSONB NOT NULL,
    "milestones" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecoveryPlan_consumerId_key" ON "RecoveryPlan"("consumerId");

ALTER TABLE "RecoveryPlan"
ADD CONSTRAINT "RecoveryPlan_consumerId_fkey"
FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
