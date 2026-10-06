import { describe, expect, it } from 'vitest';
import {
  analyzeRootCause,
  correlateAnomalies,
  upstreamDistances,
} from '../packages/shared/src/analysis';
import { createDemoSnapshot } from '../packages/shared/src/demo';
import {
  createIncidentSchema,
  durationMinutes,
  ingestSchema,
  matchesQuery,
  type Anomaly,
} from '../packages/shared/src';
const data = createDemoSnapshot();
const events: Anomaly[] = data.events
  .filter((e) => e.incidentId === 'INC-1042' && e.magnitude > 0)
  .map((e) => ({ ...e, environment: 'production' }));
describe('deterministic root cause analysis', () => {
  it('ranks the early database anomaly over the upstream symptoms', () => {
    const result = analyzeRootCause(events, data.dependencies, data.services, data.demoTime);
    expect(result.candidates[0].serviceId).toBe('postgres-main');
    expect(result.candidates[0].score).toBe(0.91);
    expect(
      result.candidates[0].evidence.some((e) => e.includes('payment-service degraded 22s')),
    ).toBe(true);
    expect(result.candidates[0].score).toBeGreaterThan(result.candidates[1].score);
  });
  it('is independent of input ordering', () => {
    expect(
      analyzeRootCause([...events].reverse(), data.dependencies, data.services, data.demoTime),
    ).toEqual(analyzeRootCause(events, data.dependencies, data.services, data.demoTime));
  });
  it('handles missing evidence without inventing a cause', () => {
    expect(
      analyzeRootCause([], data.dependencies, data.services, data.demoTime).candidates,
    ).toEqual([]);
  });
  it('is cycle safe and traverses dependencies in the propagation direction', () => {
    const distances = upstreamDistances('db', [
      { source: 'api', target: 'db' },
      { source: 'db', target: 'api' },
      { source: 'web', target: 'api' },
    ]);
    expect([...distances]).toEqual([
      ['db', 0],
      ['api', 1],
      ['web', 2],
    ]);
  });
  it('does not assign propagation credit to an upstream failure that happened first', () => {
    const late = events.map((e) =>
      e.serviceId === 'postgres-main' ? { ...e, timestamp: '2026-09-13T14:33:00.000Z' } : e,
    );
    const result = analyzeRootCause(late, data.dependencies, data.services, data.demoTime);
    expect(
      result.candidates.find((c) => c.serviceId === 'postgres-main')?.factors.propagation,
    ).toBe(0);
  });
  it('does not mistake a repeated upstream symptom for its first degradation', () => {
    const repeated: Anomaly[] = [
      {
        ...events[0],
        id: 'upstream-first',
        serviceId: 'payment-service',
        timestamp: '2026-09-13T14:31:50.000Z',
      },
      {
        ...events[0],
        id: 'database-later',
        serviceId: 'postgres-main',
        timestamp: '2026-09-13T14:32:00.000Z',
      },
      {
        ...events[0],
        id: 'upstream-repeat',
        serviceId: 'payment-service',
        timestamp: '2026-09-13T14:32:10.000Z',
      },
    ];
    const result = analyzeRootCause(repeated, data.dependencies, data.services, data.demoTime);
    const database = result.candidates.find(
      (candidate) => candidate.serviceId === 'postgres-main',
    )!;
    expect(database.factors.propagation).toBe(0);
    expect(database.evidence.some((line) => line.includes('payment-service degraded'))).toBe(false);
  });
  it('keeps evidence order stable when multiple anomalies have the same timestamp', () => {
    const tied = [
      events[0],
      { ...events[0], id: 'another-signal', description: 'Another observed signal' },
    ];
    expect(analyzeRootCause(tied, data.dependencies, data.services, data.demoTime)).toEqual(
      analyzeRootCause([...tied].reverse(), data.dependencies, data.services, data.demoTime),
    );
  });
});
describe('incident correlation', () => {
  it('groups the database to gateway cascade and deduplicates IDs', () => {
    const groups = correlateAnomalies([...events, events[0]], data.dependencies);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(events.length);
  });
  it('isolates environments, disconnected services, and time windows', () => {
    const extra: Anomaly[] = [
      { ...events[0], id: 'staging-event', environment: 'staging' },
      { ...events[0], id: 'unrelated', serviceId: 'unrelated-service' },
      { ...events[0], id: 'later', timestamp: '2026-09-13T15:00:00.000Z' },
    ];
    expect(correlateAnomalies([...events, ...extra], data.dependencies)).toHaveLength(4);
  });
  it('ignores low magnitude noise', () => {
    expect(correlateAnomalies([{ ...events[0], magnitude: 0.1 }], data.dependencies)).toEqual([]);
  });
  it('does not extend one incident indefinitely through chained events', () => {
    const chain = Array.from({ length: 4 }, (_, i) => ({
      ...events[0],
      id: `chain-${i}`,
      timestamp: new Date(Date.parse(events[0].timestamp) + i * 90000).toISOString(),
    }));
    expect(correlateAnomalies(chain, data.dependencies)).toHaveLength(2);
  });
});
describe('contracts and utilities', () => {
  it('keeps demo deployments and OpenTelemetry identifiers consistent', () => {
    expect(
      data.deployments.find((deployment) => deployment.serviceId === 'payment-service')?.version,
    ).toBe('v2.4.1');
    const traceIds = new Set(data.traces.map((trace) => trace.id));
    expect(data.traces.every((trace) => /^[a-f0-9]{32}$/.test(trace.id))).toBe(true);
    expect(
      data.traces.every((trace) => trace.spans.every((span) => /^[a-f0-9]{16}$/.test(span.id))),
    ).toBe(true);
    expect(data.logs.every((log) => traceIds.has(log.traceId))).toBe(true);
  });
  it('supports AND / OR search groups without executing expressions', () => {
    expect(matchesQuery('Connection pool timeout', 'timeout OR unavailable')).toBe(true);
    expect(matchesQuery('Connection pool timeout', 'connection AND timeout')).toBe(true);
    expect(matchesQuery('Health check passed', 'timeout OR connection')).toBe(false);
  });
  it('rejects malformed timestamps, oversized batches, and invalid magnitudes', () => {
    expect(
      ingestSchema.safeParse({ events: [{ ...events[0], timestamp: 'yesterday' }] }).success,
    ).toBe(false);
    expect(
      ingestSchema.safeParse({ events: [{ ...events[0], magnitude: Infinity }] }).success,
    ).toBe(false);
    expect(ingestSchema.safeParse({ events: Array(101).fill(events[0]) }).success).toBe(false);
  });
  it('requires at least one affected service', () => {
    expect(
      createIncidentSchema.safeParse({
        title: 'Payment failure',
        severity: 'SEV-1',
        environment: 'production',
        serviceIds: [],
      }).success,
    ).toBe(false);
  });
  it('freezes resolved duration and clamps future start times', () => {
    expect(
      durationMinutes(
        { ...data.incidents[0], resolvedAt: '2026-09-13T14:41:42.000Z' },
        data.demoTime,
      ),
    ).toBe(10);
    expect(durationMinutes(data.incidents[0], '2026-09-13T10:00:00.000Z')).toBe(0);
  });
});
