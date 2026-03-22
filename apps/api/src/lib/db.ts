import { PrismaClient } from '@prisma/client';

declare global {
  var __clarityPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__clarityPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__clarityPrisma = prisma;
}
