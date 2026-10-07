import 'dotenv/config';
import { z } from 'zod';
export function loadConfig(env: NodeJS.ProcessEnv) {
  const parsed = z
    .object({
      PORT: z.coerce.number().int().min(1).max(65535).default(4100),
      HOST: z.string().default('127.0.0.1'),
      WEB_ORIGIN: z.string().url().default('http://localhost:3100'),
      STORAGE_MODE: z.enum(['demo', 'postgres']).default('demo'),
      DEMO_MODE: z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
      DATABASE_URL: z.string().optional(),
      REDIS_URL: z.string().optional(),
      ADMIN_EMAIL: z.string().email().default('admin@incidentgraph.local'),
      ADMIN_PASSWORD: z.string().min(16).max(256).optional(),
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    })
    .parse(env);
  const origin = new URL(parsed.WEB_ORIGIN);
  if (origin.origin !== parsed.WEB_ORIGIN || origin.username || origin.password)
    throw new Error('WEB_ORIGIN must be an exact origin without a path or credentials');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (origin.protocol !== 'https:' && !(local && parsed.NODE_ENV !== 'production'))
    throw new Error('HTTPS is required outside local development');
  if (parsed.STORAGE_MODE === 'postgres' && !parsed.DATABASE_URL)
    throw new Error('DATABASE_URL is required for postgres storage');
  if (parsed.DEMO_MODE && parsed.STORAGE_MODE !== 'demo')
    throw new Error('Public demo credentials cannot be used with PostgreSQL');
  if (!parsed.DEMO_MODE && (!parsed.ADMIN_PASSWORD || parsed.ADMIN_PASSWORD === 'investigate-demo'))
    throw new Error('Set a unique ADMIN_PASSWORD (at least 16 characters), or run npm run setup');
  return {
    ...parsed,
    ADMIN_EMAIL: parsed.DEMO_MODE ? 'demo@incidentgraph.dev' : parsed.ADMIN_EMAIL,
    ADMIN_PASSWORD: parsed.DEMO_MODE ? 'investigate-demo' : parsed.ADMIN_PASSWORD!,
  };
}
export const config = loadConfig(process.env);
