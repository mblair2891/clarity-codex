ALTER TABLE "Organization"
ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "Organization_tenantId_slug_key"
ON "Organization"("tenantId", "slug");
