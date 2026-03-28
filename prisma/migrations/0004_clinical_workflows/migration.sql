CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "noteType" TEXT NOT NULL DEFAULT 'progress',
    "title" TEXT,
    "body" TEXT NOT NULL,
    "flaggedForFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CheckInReview" (
    "id" TEXT NOT NULL,
    "checkInId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reviewerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "followUpStatus" TEXT NOT NULL DEFAULT 'not_needed',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "outreachCompletedAt" TIMESTAMP(3),
    "riskFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckInReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CheckInReview_checkInId_key" ON "CheckInReview"("checkInId");
CREATE INDEX "ClinicalNote_consumerId_createdAt_idx" ON "ClinicalNote"("consumerId", "createdAt");
CREATE INDEX "ClinicalNote_organizationId_createdAt_idx" ON "ClinicalNote"("organizationId", "createdAt");
CREATE INDEX "CheckInReview_consumerId_updatedAt_idx" ON "CheckInReview"("consumerId", "updatedAt");
CREATE INDEX "CheckInReview_organizationId_status_idx" ON "CheckInReview"("organizationId", "status");

ALTER TABLE "ClinicalNote"
ADD CONSTRAINT "ClinicalNote_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ClinicalNote"
ADD CONSTRAINT "ClinicalNote_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ClinicalNote"
ADD CONSTRAINT "ClinicalNote_consumerId_fkey"
FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ClinicalNote"
ADD CONSTRAINT "ClinicalNote_authorUserId_fkey"
FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "CheckInReview"
ADD CONSTRAINT "CheckInReview_checkInId_fkey"
FOREIGN KEY ("checkInId") REFERENCES "DailyCheckIn"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "CheckInReview"
ADD CONSTRAINT "CheckInReview_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "CheckInReview"
ADD CONSTRAINT "CheckInReview_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "CheckInReview"
ADD CONSTRAINT "CheckInReview_consumerId_fkey"
FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "CheckInReview"
ADD CONSTRAINT "CheckInReview_reviewerUserId_fkey"
FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
