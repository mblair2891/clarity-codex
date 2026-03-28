-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('platform_admin', 'org_admin', 'clinician', 'case_manager', 'billing', 'support', 'consumer');

-- CreateEnum
CREATE TYPE "ConditionStatus" AS ENUM ('active', 'inactive', 'resolved');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('scheduled', 'completed', 'canceled', 'no_show');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('draft', 'submitted', 'accepted', 'denied', 'paid');

-- CreateEnum
CREATE TYPE "AiActionType" AS ENUM ('recovery_coach', 'journaling_assist', 'weekly_insight', 'clinical_summary', 'denial_analysis');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "npi" TEXT,
    "taxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consumer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "traumaMode" BOOLEAN NOT NULL DEFAULT false,
    "cognitiveAssistMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consumer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCheckIn" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "mood" INTEGER NOT NULL,
    "cravings" INTEGER NOT NULL,
    "sleepHours" DOUBLE PRECISION,
    "gratitude" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "aiSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3),

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumerCondition" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ConditionStatus" NOT NULL,
    "accommodation" TEXT,
    "symptomScore" INTEGER,
    "traumaTriggerProfile" JSONB,

    CONSTRAINT "ConsumerCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPlan" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "goals" JSONB NOT NULL,
    "interventions" JSONB NOT NULL,
    "reviewDate" TIMESTAMP(3),

    CONSTRAINT "TreatmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionNote" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "subjective" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "assessment" TEXT NOT NULL,
    "plan" TEXT NOT NULL,

    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationRecord" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "dosage" TEXT,
    "schedule" TEXT,

    CONSTRAINT "MedicationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Payer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsurancePlan" (
    "id" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "InsurancePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coverage" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "groupNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Authorization" (
    "id" TEXT NOT NULL,
    "coverageId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "authorizedUnits" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Authorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "serviceCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "cptCode" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeSchedule" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "rateCents" INTEGER NOT NULL,

    CONSTRAINT "FeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL,
    "billedCents" INTEGER NOT NULL,
    "paidCents" INTEGER,
    "denialReason" TEXT,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Remittance" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Remittance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Denial" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Denial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientLedgerEntry" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptRegistry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actionType" "AiActionType" NOT NULL,
    "version" TEXT NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "guardrails" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PromptRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "actionType" "AiActionType" NOT NULL,
    "inputSummary" TEXT NOT NULL,
    "outputSummary" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "SessionNote_appointmentId_key" ON "SessionNote"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Remittance_claimId_key" ON "Remittance"("claimId");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCheckIn" ADD CONSTRAINT "DailyCheckIn_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerCondition" ADD CONSTRAINT "ConsumerCondition_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSession" ADD CONSTRAINT "GroupSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationRecord" ADD CONSTRAINT "MedicationRecord_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payer" ADD CONSTRAINT "Payer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePlan" ADD CONSTRAINT "InsurancePlan_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coverage" ADD CONSTRAINT "Coverage_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coverage" ADD CONSTRAINT "Coverage_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InsurancePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authorization" ADD CONSTRAINT "Authorization_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "Coverage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InsurancePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remittance" ADD CONSTRAINT "Remittance_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Denial" ADD CONSTRAINT "Denial_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientLedgerEntry" ADD CONSTRAINT "PatientLedgerEntry_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptRegistry" ADD CONSTRAINT "PromptRegistry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

