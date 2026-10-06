import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
const credentials = parseEnv(await readFile(new URL('../../.env', import.meta.url), 'utf8'));

// Runs only against the disposable Compose stack, never a user-supplied deployment.
const base = 'http://localhost:3100';
const stateFile = new URL('../../.data/compose-smoke.json', import.meta.url);
let cookie;
async function api(path, method = 'GET', data) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: base,
      'X-IncidentGraph-Request': '1',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`);
  return response;
}
const health = await (await api('/health')).json();
assert.equal(health.storage, 'postgres');
assert.equal((await fetch(`${base}/api/bootstrap`)).status, 401);
const login = await api('/auth/login', 'POST', {
  email: credentials.ADMIN_EMAIL,
  password: credentials.ADMIN_PASSWORD,
});
cookie = login.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie?.startsWith('ig_session='));

if (process.argv.includes('--verify-persistence')) {
  const { id } = JSON.parse(await readFile(stateFile, 'utf8'));
  const incident = await (await api(`/incidents/${id}`)).json();
  assert.equal(incident.status, 'Monitoring');
  assert.ok(incident.annotations.some((note) => note.body === 'Verified in Docker Compose.'));
  console.log('PASS: incident and annotation persist after the API container restarts.');
} else {
  const page = await fetch(`${base}/app/overview`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes('IncidentGraph'));
  const assets = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^" ]+\.(?:js|css))"/g)];
  assert.ok(assets.length > 0, 'Production page includes built assets');
  for (const [, asset] of assets.slice(0, 4)) {
    assert.equal((await fetch(`${base}${asset}`)).status, 200, asset);
  }
  const workspace = await (await api('/bootstrap')).json();
  assert.equal(workspace.services.length, 11);
  const metrics = await (await api('/metrics?service=postgres-main')).json();
  assert.ok(metrics.length > 0);
  assert.equal((await (await api('/auth/me')).json()).email, credentials.ADMIN_EMAIL);
  const incident = await (
    await api('/incidents', 'POST', {
      title: 'Docker Compose persistence verification',
      severity: 'SEV-3',
      environment: 'production',
      serviceIds: ['postgres-main'],
      owner: 'Alex Morgan',
    })
  ).json();
  await api(`/incidents/${incident.id}`, 'PATCH', { status: 'Monitoring' });
  await api(`/incidents/${incident.id}/annotations`, 'POST', {
    body: 'Verified in Docker Compose.',
  });
  await mkdir(new URL('../../.data/', import.meta.url), { recursive: true });
  await writeFile(stateFile, JSON.stringify({ id: incident.id }));
  console.log('PASS: Compose frontend assets, API proxy, PostgreSQL reads, sessions and writes.');
}
