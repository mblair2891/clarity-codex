-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('platform_admin', 'support');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('org_admin', 'clinical_staff', 'clinician', 'case_manager', 'billing', 'consumer');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'invited', 'suspended', 'revoked');

-- DropForeignKey
ALTER TABLE "Consumer" DROP CONSTRAINT "Consumer_organizationId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "normalizedEmail" TEXT;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "organizationRole" "OrganizationRole",
ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Consumer" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "DailyCheckIn" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "RoutineCompletion" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "RecoveryPlan" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ConsumerCondition" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "TreatmentPlan" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "SessionNote" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "MedicationRecord" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Coverage" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Authorization" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Charge" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "BillingWorkItemActivity" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Remittance" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Denial" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "PatientLedgerEntry" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "supportAccessSessionId" TEXT,
ADD COLUMN     "supportMode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UserPlatformRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPlatformRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,
    "activeMembershipId" TEXT,
    "activeLocationId" TEXT,
    "supportAccessSessionId" TEXT,
    "supportMode" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipLocation" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAccessSession" (
    "id" TEXT NOT NULL,
    "supportUserId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "membershipId" TEXT,
    "locationId" TEXT,
    "reason" TEXT,
    "ticketRef" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAccessSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPlatformRole_userId_idx" ON "UserPlatformRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPlatformRole_userId_role_key" ON "UserPlatformRole"("userId", "role");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_activeOrganizationId_idx" ON "UserSession"("activeOrganizationId");

-- CreateIndex
CREATE INDEX "UserSession_activeMembershipId_idx" ON "UserSession"("activeMembershipId");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "Location_organizationId_idx" ON "Location"("organizationId");

-- CreateIndex
CREATE INDEX "MembershipLocation_membershipId_idx" ON "MembershipLocation"("membershipId");

-- CreateIndex
CREATE INDEX "MembershipLocation_locationId_idx" ON "MembershipLocation"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipLocation_membershipId_locationId_key" ON "MembershipLocation"("membershipId", "locationId");

-- CreateIndex
CREATE INDEX "SupportAccessSession_supportUserId_idx" ON "SupportAccessSession"("supportUserId");

-- CreateIndex
CREATE INDEX "SupportAccessSession_organizationId_idx" ON "SupportAccessSession"("organizationId");

-- CreateIndex
CREATE INDEX "SupportAccessSession_expiresAt_idx" ON "SupportAccessSession"("expiresAt");

-- CreateIndex
CREATE INDEX "User_normalizedEmail_idx" ON "User"("normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_sessionId_idx" ON "AuditLog"("sessionId");

-- CreateIndex
CREATE INDEX "AuditLog_supportAccessSessionId_idx" ON "AuditLog"("supportAccessSessionId");

-- AddForeignKey
ALTER TABLE "UserPlatformRole" ADD CONSTRAINT "UserPlatformRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipLocation" ADD CONSTRAINT "MembershipLocation_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipLocation" ADD CONSTRAINT "MembershipLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
