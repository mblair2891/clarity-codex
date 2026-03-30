CREATE TYPE "OrganizationOnboardingStatus" AS ENUM ('draft', 'in_progress', 'submitted', 'reviewed', 'active');

CREATE TABLE "OrganizationOnboarding" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" "OrganizationOnboardingStatus" NOT NULL DEFAULT 'draft',
  "currentStep" TEXT,
  "answers" JSONB,
  "recommendation" JSONB,
  "recommendedPlanId" TEXT,
  "selectedPlanId" TEXT,
  "recommendedFeatureKeys" JSONB,
  "selectedFeatureKeys" JSONB,
  "requiresImport" BOOLEAN NOT NULL DEFAULT false,
  "importTypes" JSONB,
  "sourceSystem" TEXT,
  "sourceFormat" TEXT,
  "migrationAssistRequested" BOOLEAN NOT NULL DEFAULT false,
  "aiSummary" TEXT,
  "aiExplanation" TEXT,
  "aiMigrationRiskSummary" TEXT,
  "adminReviewNotes" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationOnboarding_organizationId_key" ON "OrganizationOnboarding"("organizationId");
CREATE INDEX "OrganizationOnboarding_tenantId_status_updatedAt_idx" ON "OrganizationOnboarding"("tenantId", "status", "updatedAt");
CREATE INDEX "OrganizationOnboarding_recommendedPlanId_idx" ON "OrganizationOnboarding"("recommendedPlanId");
CREATE INDEX "OrganizationOnboarding_selectedPlanId_idx" ON "OrganizationOnboarding"("selectedPlanId");

ALTER TABLE "OrganizationOnboarding"
ADD CONSTRAINT "OrganizationOnboarding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationOnboarding"
ADD CONSTRAINT "OrganizationOnboarding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationOnboarding"
ADD CONSTRAINT "OrganizationOnboarding_recommendedPlanId_fkey" FOREIGN KEY ("recommendedPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizationOnboarding"
ADD CONSTRAINT "OrganizationOnboarding_selectedPlanId_fkey" FOREIGN KEY ("selectedPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
