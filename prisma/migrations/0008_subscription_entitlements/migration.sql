CREATE TYPE "SubscriptionStatus" AS ENUM ('draft', 'trialing', 'active', 'past_due', 'suspended', 'canceled');

CREATE TYPE "OrganizationInvoiceStatus" AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');

CREATE TYPE "OrganizationInvoiceLineItemType" AS ENUM (
  'base_plan',
  'feature_add_on',
  'usage_active_client',
  'usage_clinician',
  'adjustment',
  'credit'
);

CREATE TABLE "SubscriptionPlan" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "basePriceCents" INTEGER NOT NULL DEFAULT 0,
  "activeClientPriceCents" INTEGER NOT NULL DEFAULT 0,
  "clinicianPriceCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "billingInterval" TEXT NOT NULL DEFAULT 'month',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformFeature" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformFeature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanFeature" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "featureId" TEXT NOT NULL,
  "included" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationSubscription" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "planId" TEXT,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'draft',
  "billingStatus" TEXT NOT NULL DEFAULT 'not_configured',
  "basePriceCents" INTEGER NOT NULL DEFAULT 0,
  "activeClientPriceCents" INTEGER NOT NULL DEFAULT 0,
  "clinicianPriceCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "billingInterval" TEXT NOT NULL DEFAULT 'month',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trialEndsAt" TIMESTAMP(3),
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "billingProvider" TEXT,
  "billingCustomerId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationFeatureOverride" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "featureId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "reason" TEXT,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationFeatureOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationUsageSnapshot" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "snapshotDate" TIMESTAMP(3) NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "activeClients" INTEGER NOT NULL DEFAULT 0,
  "activeClinicians" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationUsageSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationInvoice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "status" "OrganizationInvoiceStatus" NOT NULL DEFAULT 'draft',
  "invoiceNumber" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "subtotalCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL DEFAULT 0,
  "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "billingProvider" TEXT,
  "billingCustomerId" TEXT,
  "externalInvoiceId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationInvoiceLineItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "type" "OrganizationInvoiceLineItemType" NOT NULL,
  "featureKey" TEXT,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitAmountCents" INTEGER NOT NULL DEFAULT 0,
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationInvoiceLineItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPlan_tenantId_key_key"
ON "SubscriptionPlan"("tenantId", "key");

CREATE INDEX "SubscriptionPlan_tenantId_isActive_sortOrder_idx"
ON "SubscriptionPlan"("tenantId", "isActive", "sortOrder");

CREATE UNIQUE INDEX "PlatformFeature_tenantId_key_key"
ON "PlatformFeature"("tenantId", "key");

CREATE INDEX "PlatformFeature_tenantId_isActive_sortOrder_idx"
ON "PlatformFeature"("tenantId", "isActive", "sortOrder");

CREATE UNIQUE INDEX "PlanFeature_planId_featureId_key"
ON "PlanFeature"("planId", "featureId");

CREATE INDEX "PlanFeature_featureId_idx"
ON "PlanFeature"("featureId");

CREATE UNIQUE INDEX "OrganizationSubscription_organizationId_key"
ON "OrganizationSubscription"("organizationId");

CREATE INDEX "OrganizationSubscription_tenantId_status_idx"
ON "OrganizationSubscription"("tenantId", "status");

CREATE INDEX "OrganizationSubscription_planId_idx"
ON "OrganizationSubscription"("planId");

CREATE UNIQUE INDEX "OrganizationFeatureOverride_organizationId_featureId_key"
ON "OrganizationFeatureOverride"("organizationId", "featureId");

CREATE INDEX "OrganizationFeatureOverride_tenantId_organizationId_idx"
ON "OrganizationFeatureOverride"("tenantId", "organizationId");

CREATE UNIQUE INDEX "OrganizationUsageSnapshot_organizationId_periodStart_periodEnd_key"
ON "OrganizationUsageSnapshot"("organizationId", "periodStart", "periodEnd");

CREATE INDEX "OrganizationUsageSnapshot_tenantId_snapshotDate_idx"
ON "OrganizationUsageSnapshot"("tenantId", "snapshotDate");

CREATE INDEX "OrganizationInvoice_tenantId_status_invoiceDate_idx"
ON "OrganizationInvoice"("tenantId", "status", "invoiceDate");

CREATE INDEX "OrganizationInvoiceLineItem_invoiceId_idx"
ON "OrganizationInvoiceLineItem"("invoiceId");

ALTER TABLE "SubscriptionPlan"
ADD CONSTRAINT "SubscriptionPlan_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlatformFeature"
ADD CONSTRAINT "PlatformFeature_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlanFeature"
ADD CONSTRAINT "PlanFeature_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlanFeature"
ADD CONSTRAINT "PlanFeature_featureId_fkey"
FOREIGN KEY ("featureId") REFERENCES "PlatformFeature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationSubscription"
ADD CONSTRAINT "OrganizationSubscription_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationSubscription"
ADD CONSTRAINT "OrganizationSubscription_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationSubscription"
ADD CONSTRAINT "OrganizationSubscription_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizationFeatureOverride"
ADD CONSTRAINT "OrganizationFeatureOverride_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationFeatureOverride"
ADD CONSTRAINT "OrganizationFeatureOverride_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationFeatureOverride"
ADD CONSTRAINT "OrganizationFeatureOverride_featureId_fkey"
FOREIGN KEY ("featureId") REFERENCES "PlatformFeature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationUsageSnapshot"
ADD CONSTRAINT "OrganizationUsageSnapshot_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationUsageSnapshot"
ADD CONSTRAINT "OrganizationUsageSnapshot_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationUsageSnapshot"
ADD CONSTRAINT "OrganizationUsageSnapshot_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvoice"
ADD CONSTRAINT "OrganizationInvoice_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvoice"
ADD CONSTRAINT "OrganizationInvoice_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvoice"
ADD CONSTRAINT "OrganizationInvoice_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvoiceLineItem"
ADD CONSTRAINT "OrganizationInvoiceLineItem_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "OrganizationInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
