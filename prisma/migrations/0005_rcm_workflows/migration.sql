CREATE TYPE "BillingWorkItemStatus" AS ENUM (
  'draft',
  'ready_for_review',
  'submitted',
  'needs_correction',
  'paid',
  'denied',
  'follow_up_needed'
);

CREATE TABLE "BillingWorkItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "consumerId" TEXT NOT NULL,
  "encounterId" TEXT,
  "claimId" TEXT,
  "coverageId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "title" TEXT NOT NULL,
  "status" "BillingWorkItemStatus" NOT NULL DEFAULT 'draft',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "payerName" TEXT,
  "issueSummary" TEXT,
  "nextAction" TEXT,
  "amountCents" INTEGER,
  "serviceDate" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BillingWorkItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingNote" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "consumerId" TEXT NOT NULL,
  "workItemId" TEXT,
  "authorUserId" TEXT NOT NULL,
  "noteType" TEXT NOT NULL DEFAULT 'billing_note',
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BillingNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingWorkItemActivity" (
  "id" TEXT NOT NULL,
  "workItemId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "fromStatus" "BillingWorkItemStatus",
  "toStatus" "BillingWorkItemStatus",
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BillingWorkItemActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BillingWorkItem_organizationId_status_updatedAt_idx" ON "BillingWorkItem"("organizationId", "status", "updatedAt");
CREATE INDEX "BillingWorkItem_consumerId_updatedAt_idx" ON "BillingWorkItem"("consumerId", "updatedAt");
CREATE INDEX "BillingNote_consumerId_createdAt_idx" ON "BillingNote"("consumerId", "createdAt");
CREATE INDEX "BillingNote_workItemId_createdAt_idx" ON "BillingNote"("workItemId", "createdAt");
CREATE INDEX "BillingWorkItemActivity_workItemId_createdAt_idx" ON "BillingWorkItemActivity"("workItemId", "createdAt");

ALTER TABLE "BillingWorkItem"
ADD CONSTRAINT "BillingWorkItem_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingWorkItem"
ADD CONSTRAINT "BillingWorkItem_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingWorkItem"
ADD CONSTRAINT "BillingWorkItem_consumerId_fkey"
FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingWorkItem"
ADD CONSTRAINT "BillingWorkItem_encounterId_fkey"
FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingWorkItem"
ADD CONSTRAINT "BillingWorkItem_claimId_fkey"
FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingWorkItem"
ADD CONSTRAINT "BillingWorkItem_coverageId_fkey"
FOREIGN KEY ("coverageId") REFERENCES "Coverage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingWorkItem"
ADD CONSTRAINT "BillingWorkItem_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingWorkItem"
ADD CONSTRAINT "BillingWorkItem_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingNote"
ADD CONSTRAINT "BillingNote_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingNote"
ADD CONSTRAINT "BillingNote_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingNote"
ADD CONSTRAINT "BillingNote_consumerId_fkey"
FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingNote"
ADD CONSTRAINT "BillingNote_workItemId_fkey"
FOREIGN KEY ("workItemId") REFERENCES "BillingWorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingNote"
ADD CONSTRAINT "BillingNote_authorUserId_fkey"
FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingWorkItemActivity"
ADD CONSTRAINT "BillingWorkItemActivity_workItemId_fkey"
FOREIGN KEY ("workItemId") REFERENCES "BillingWorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingWorkItemActivity"
ADD CONSTRAINT "BillingWorkItemActivity_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
