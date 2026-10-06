import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { createApplication } from '../apps/api/src/main';
import { loadConfig } from '../apps/api/src/config';
import { SessionStore } from '../apps/api/src/auth';
import { WindowLimiter } from '../apps/api/src/security';

describe('fail-closed configuration and bounded sessions', () => {
  it('rejects missing/default passwords and insecure remote origins', () => {
    expect(() => loadConfig({})).toThrow('ADMIN_PASSWORD');
    expect(() => loadConfig({ ADMIN_PASSWORD: 'investigate-demo' })).toThrow();
    expect(() =>
      loadConfig({
        ADMIN_PASSWORD: 'test-only-workspace-password',
        WEB_ORIGIN: 'http://example.com',
      }),
    ).toThrow('HTTPS');
    expect(() =>
      loadConfig({ ADMIN_PASSWORD: 'test-only-workspace-password', NODE_ENV: 'production' }),
    ).toThrow('HTTPS');
    expect(() =>
      loadConfig({
        DEMO_MODE: 'true',
        STORAGE_MODE: 'postgres',
        DATABASE_URL: 'postgresql://localhost/test',
      }),
    ).toThrow('Public demo');
    expect(loadConfig({ ADMIN_PASSWORD: 'test-only-workspace-password' }).HOST).toBe('127.0.0.1');
  });
  it('uses unique opaque tokens, expires and revokes them, and bounds memory', () => {
    let now = 100;
    const store = new SessionStore(() => now, 1000, 2);
    const first = store.issue(),
      second = store.issue();
    expect(first).not.toBe(second);
    expect(store.valid(first)).toBe(true);
    expect(store.valid(`${first}.forged`)).toBe(false);
    store.revoke(first);
    expect(store.valid(first)).toBe(false);
    const third = store.issue();
    store.issue();
    expect(store.valid(second)).toBe(false);
    now += 1001;
    expect(store.valid(third)).toBe(false);
    expect(new SessionStore().valid(third)).toBe(false);
  });
  it('caps limiter keys and resets expired windows', () => {
    let now = 0;
    const limiter = new WindowLimiter(2, 1000, 2, () => now);
    expect(limiter.allow('a')).toBe(true);
    expect(limiter.allow('a')).toBe(true);
    expect(limiter.allow('a')).toBe(false);
    expect(limiter.allow('b')).toBe(true);
    expect(limiter.allow('c')).toBe(false);
    now = 1001;
    expect(limiter.allow('c')).toBe(true);
  });
});

describe('HTTP security boundary', () => {
  let app: INestApplication, base: string, directory: string, cookie: string;
  const logs: string[] = [];
  const headers = { 'Content-Type': 'application/json', 'X-IncidentGraph-Request': '1' };
  const credentials = { email: 'admin@incidentgraph.local', password: 'unit-test-workspace-only' };
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'incidentgraph-security-'));
    process.env.DEMO_DATA_PATH = join(directory, 'snapshot.json');
    vi.spyOn(console, 'log').mockImplementation((line) => logs.push(String(line)));
    app = await createApplication();
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/api`;
  });
  afterAll(async () => {
    await app?.close();
    vi.restoreAllMocks();
    delete process.env.DEMO_DATA_PATH;
    const target = relative(tmpdir(), directory);
    if (!target.startsWith('incidentgraph-security-') || target.includes('..'))
      throw new Error('Unsafe cleanup');
    await rm(directory, { recursive: true, force: true });
  });
  async function login(existing?: string) {
    const response = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { ...headers, ...(existing ? { Cookie: existing } : {}) },
      body: JSON.stringify(credentials),
    });
    expect(response.status).toBe(200);
    const setCookie = response.headers.get('set-cookie')!;
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    return setCookie.split(';')[0];
  }
  it('denies every telemetry endpoint to anonymous clients and forged sessions', async () => {
    for (const path of [
      '/bootstrap',
      '/incidents',
      '/incidents/INC-1042',
      '/logs',
      '/metrics',
      '/search?q=payment',
    ]) {
      for (const token of ['', 'ig_session=forged-session']) {
        const response = await fetch(base + path, { headers: { Cookie: token } });
        expect(response.status, path).toBe(401);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await response.text()).not.toContain('PostgreSQL');
      }
    }
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect(await (await fetch(`${base}/auth/me`)).json()).toBeNull();
    expect(await (await fetch(`${base}/auth/config`)).json()).toEqual({ demoMode: false });
    cookie = await login();
    expect((await fetch(`${base}/bootstrap`, { headers: { Cookie: cookie } })).status).toBe(200);
  });
  it('rejects cross-origin, missing-header and simple-form mutations', async () => {
    const probes = [
      { ...headers, Origin: 'https://attacker.invalid' },
      { ...headers, Origin: 'null' },
      { 'Content-Type': 'application/json' },
      { ...headers, 'Sec-Fetch-Site': 'cross-site' },
    ];
    for (const probe of probes) {
      const response = await fetch(`${base}/incidents/INC-1042`, {
        method: 'PATCH',
        headers: { ...probe, Cookie: cookie },
        body: '{"status":"Resolved"}',
      });
      expect(response.status).toBe(403);
    }
    const plain = await fetch(`${base}/auth/logout`, {
      method: 'POST',
      headers: { ...headers, Cookie: cookie, 'Content-Type': 'text/plain' },
      body: '{}',
    });
    expect(plain.status).toBe(415);
  });
  it('limits bodies, rejects malformed JSON and does not reflect payloads in errors or logs', async () => {
    const marker = 'private-security-canary-do-not-log';
    const malformed = await fetch(`${base}/incidents`, {
      method: 'POST',
      headers: { ...headers, Cookie: cookie },
      body: `{${marker}`,
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.text()).not.toContain(marker);
    const oversized = await fetch(`${base}/incidents`, {
      method: 'POST',
      headers: { ...headers, Cookie: cookie },
      body: JSON.stringify({ title: 'x'.repeat(270000) }),
    });
    expect(oversized.status).toBe(413);
    await fetch(`${base}/${marker}?password=${marker}`, { headers: { Cookie: cookie } });
    expect(logs.join('\n')).not.toContain(marker);
    expect(logs.join('\n')).not.toContain(credentials.password);
    expect(logs.join('\n')).not.toContain(cookie);
  });
  it('rotates sessions on login and rejects replay after logout', async () => {
    const old = cookie;
    cookie = await login(old);
    expect(cookie).not.toBe(old);
    expect((await fetch(`${base}/logs`, { headers: { Cookie: old } })).status).toBe(401);
    expect(
      (
        await fetch(`${base}/auth/logout`, {
          method: 'POST',
          headers: { ...headers, Cookie: cookie },
          body: '{}',
        })
      ).status,
    ).toBe(200);
    expect((await fetch(`${base}/logs`, { headers: { Cookie: cookie } })).status).toBe(401);
  });
  it('throttles password guessing even with forged forwarding headers', async () => {
    let response: Response | undefined;
    for (let i = 0; i < 12; i++) {
      response = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { ...headers, 'X-Forwarded-For': `192.0.2.${i}` },
        body: JSON.stringify({ ...credentials, password: 'wrong' }),
      });
    }
    expect(response!.status).toBe(429);
    expect(response!.headers.get('retry-after')).toBe('900');
  });
});
