import { randomBytes } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
const rootEnv = new URL('../../.env', import.meta.url);
const apiEnv = new URL('../../apps/api/.env', import.meta.url);
await mkdir(new URL('../../.data/', import.meta.url), { recursive: true, mode: 0o700 });
const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );
if (!(await exists(rootEnv))) {
  await writeFile(
    rootEnv,
    [
      '# Local credentials. Never commit or share this file.',
      'ADMIN_EMAIL=admin@incidentgraph.local',
      `ADMIN_PASSWORD=${randomBytes(32).toString('base64url')}`,
      `POSTGRES_PASSWORD=${randomBytes(32).toString('base64url')}`,
      '',
    ].join('\n'),
    { flag: 'wx', mode: 0o600 },
  );
}
const values = parseEnv(await readFile(rootEnv, 'utf8'));
if (!values.ADMIN_PASSWORD || values.ADMIN_PASSWORD.length < 16)
  throw new Error('Existing .env needs a unique ADMIN_PASSWORD. Existing files were preserved.');
if (!(await exists(apiEnv))) {
  await writeFile(
    apiEnv,
    [
      '# Local private workspace. Never commit or share this file.',
      'DEMO_MODE=false',
      'STORAGE_MODE=demo',
      'HOST=127.0.0.1',
      'WEB_ORIGIN=http://localhost:3100',
      `ADMIN_EMAIL=${values.ADMIN_EMAIL ?? 'admin@incidentgraph.local'}`,
      `ADMIN_PASSWORD=${values.ADMIN_PASSWORD}`,
      '',
    ].join('\n'),
    { flag: 'wx', mode: 0o600 },
  );
}
console.log(
  'Private local setup ready. Sign-in credentials are in apps/api/.env. Existing files were preserved.',
);
