-- Add clinical staff role for beta account routing.
ALTER TYPE "Role" ADD VALUE 'clinical_staff';

ALTER TABLE "User"
ADD COLUMN "consumerId" TEXT,
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "User_consumerId_key" ON "User"("consumerId");

ALTER TABLE "User"
ADD CONSTRAINT "User_consumerId_fkey"
FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
