import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
// One known disposable test file; never touch the interactive demo snapshot.
await rm(fileURLToPath(new URL('../../.data/e2e.json', import.meta.url)), { force: true });
