import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../src/storage';
import { createDemoSnapshot } from '../../../packages/shared/src/demo';
const db = new PrismaClient();
seedDatabase(db, createDemoSnapshot())
  .then(() => console.log('Seeded IncidentGraph demo.'))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
