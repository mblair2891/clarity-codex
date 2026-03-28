import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(16).default('local-development-secret-change-me'),
  JWT_ISSUER: z.string().default('clarity-bridge-health'),
  JWT_AUDIENCE: z.string().default('clarity-platform')
});

export type AppEnv = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
