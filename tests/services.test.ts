import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { Storage } from '../apps/api/src/storage';
import { IncidentService } from '../apps/api/src/incident-service';
import { InProcessEventProcessor } from '../apps/api/src/event-processor';
import { issueSession, validSession } from '../apps/api/src/auth';
import type { Anomaly } from '../packages/shared/src';
let storage: Storage;
let service: IncidentService;
let folder: string;
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'incidentgraph-test-'));
  process.env.DEMO_DATA_PATH = join(folder, 'snapshot.json');
  storage = new Storage();
  await storage.onModuleInit();
  service = new IncidentService(storage);
});
afterAll(async () => {
  await storage.close();
  delete process.env.DEMO_DATA_PATH;
  const cleanupTarget = relative(tmpdir(), folder);
  if (
    isAbsolute(cleanupTarget) ||
    cleanupTarget.startsWith('..') ||
    !cleanupTarget.startsWith('incidentgraph-test-')
  )
    throw new Error('Unsafe test cleanup target');
  await rm(folder, { recursive: true, force: true });
});
describe('incident application service', () => {
  it('persists creation, resolution, reopening, and annotations', async () => {
    const incident = await service.create({
      title: 'Test payment degradation',
      severity: 'SEV-2',
      serviceIds: ['payment-service'],
      environment: 'production',
      owner: 'Alex Morgan',
    });
    expect(service.find(incident.id).status).toBe('Investigating');
    const resolved = await service.update(incident.id, { status: 'Resolved' });
    expect(resolved.resolvedAt).not.toBeNull();
    await service.update(incident.id, { status: 'Monitoring' });
    expect(service.find(incident.id).resolvedAt).toBeNull();
    await storage.addAnnotation({
      id: 'test-note',
      incidentId: incident.id,
      author: 'Alex Morgan',
      body: 'Connection recovery confirmed.',
      createdAt: new Date().toISOString(),
    });
    const reloaded = new Storage();
    await reloaded.onModuleInit();
    expect(reloaded.snapshot().incidents.find((i) => i.id === incident.id)?.status).toBe(
      'Monitoring',
    );
    expect(reloaded.snapshot().annotations.some((n) => n.id === 'test-note')).toBe(true);
    await reloaded.close();
  });
  it('rejects unknown and cross-environment services', async () => {
    await expect(
      service.create({
        title: 'Invalid service example',
        severity: 'SEV-2',
        serviceIds: ['postgres-main'],
        environment: 'staging',
        owner: 'Alex Morgan',
      }),
    ).rejects.toThrow('Select services');
    expect(() => service.find('missing')).toThrow('Incident not found');
  });
  it('preserves simultaneous status, owner and analysis updates', async () => {
    await Promise.all([
      service.update('INC-1042', { status: 'Monitoring' }),
      service.update('INC-1042', { owner: 'Jordan Lee' }),
      service.analyze('INC-1042'),
    ]);
    const incident = service.find('INC-1042');
    expect(incident.status).toBe('Monitoring');
    expect(incident.owner).toBe('Jordan Lee');
    expect(incident.analysis.candidates[0].serviceId).toBe('postgres-main');
    const reloaded = new Storage();
    await reloaded.onModuleInit();
    expect(reloaded.snapshot().incidents.find((i) => i.id === incident.id)?.owner).toBe(
      'Jordan Lee',
    );
    await reloaded.close();
  });
  it('serializes duplicate ingestion batches into one incident', async () => {
    const input: Anomaly[] = [
      {
        id: 'ingest-test-1',
        timestamp: '2026-09-13T15:00:00.000Z',
        serviceId: 'postgres-main',
        environment: 'production',
        description: 'Connection pool saturated',
        metric: '99%',
        magnitude: 0.99,
        severity: 'critical',
      },
      {
        id: 'ingest-test-2',
        timestamp: '2026-09-13T15:00:18.000Z',
        serviceId: 'payment-service',
        environment: 'production',
        description: 'Payment timeout',
        metric: '1000 ms',
        magnitude: 0.8,
        severity: 'critical',
      },
    ];
    const processor = new InProcessEventProcessor(service);
    const results = await Promise.all([processor.process(input), processor.process(input)]);
    expect(results[0].incidents).toHaveLength(1);
    expect(results[1].duplicates).toBe(2);
    expect(results[1].incidents).toHaveLength(0);
    expect(results[0].incidents[0].analysis.candidates[0].serviceId).toBe('postgres-main');
  });
});
describe('demo sessions', () => {
  it('accepts a valid signed session and rejects tampering', () => {
    const token = issueSession();
    expect(validSession(token)).toBe(true);
    expect(validSession(token + 'x')).toBe(false);
    expect(validSession(token + '.extra')).toBe(false);
    expect(validSession('invalid')).toBe(false);
    expect(validSession(undefined)).toBe(false);
  });
});
