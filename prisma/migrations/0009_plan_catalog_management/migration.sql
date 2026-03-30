CREATE TYPE "PlanFeatureAvailability" AS ENUM ('included', 'add_on', 'excluded');

ALTER TABLE "SubscriptionPlan"
ADD COLUMN "shortDescription" TEXT,
ADD COLUMN "longDescription" TEXT,
ADD COLUMN "annualBasePriceCents" INTEGER,
ADD COLUMN "setupFeeCents" INTEGER,
ADD COLUMN "trialDays" INTEGER,
ADD COLUMN "includedActiveClients" INTEGER,
ADD COLUMN "includedClinicians" INTEGER,
ADD COLUMN "targetCustomerProfile" TEXT,
ADD COLUMN "customPricingRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "salesContactRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "badgeLabel" TEXT,
ADD COLUMN "maxLocations" INTEGER,
ADD COLUMN "maxOrgUsers" INTEGER,
ADD COLUMN "maxClinicians" INTEGER,
ADD COLUMN "maxActiveClients" INTEGER,
ADD COLUMN "unlimitedLocations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "unlimitedOrgUsers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "unlimitedClinicians" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "unlimitedActiveClients" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "apiAccessIncluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ssoIncluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "customBrandingIncluded" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PlatformFeature"
ADD COLUMN "longDescription" TEXT,
ADD COLUMN "isAddOn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "defaultMonthlyPriceCents" INTEGER,
ADD COLUMN "defaultAnnualPriceCents" INTEGER,
ADD COLUMN "badgeLabel" TEXT;

ALTER TABLE "PlanFeature"
ADD COLUMN "availability" "PlanFeatureAvailability" NOT NULL DEFAULT 'included',
ADD COLUMN "monthlyPriceCents" INTEGER,
ADD COLUMN "annualPriceCents" INTEGER,
ADD COLUMN "notes" TEXT;

ALTER TABLE "OrganizationSubscription"
ADD COLUMN "annualBasePriceCents" INTEGER,
ADD COLUMN "setupFeeCents" INTEGER,
ADD COLUMN "includedActiveClients" INTEGER,
ADD COLUMN "includedClinicians" INTEGER,
ADD COLUMN "trialStartsAt" TIMESTAMP(3),
ADD COLUMN "billingContactEmail" TEXT,
ADD COLUMN "customPricingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "enterpriseManaged" BOOLEAN NOT NULL DEFAULT false;

UPDATE "PlanFeature"
SET "availability" = CASE
  WHEN "included" = true THEN 'included'::"PlanFeatureAvailability"
  ELSE 'excluded'::"PlanFeatureAvailability"
END;
