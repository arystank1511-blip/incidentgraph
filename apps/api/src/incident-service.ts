import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Anomaly, Incident, IncidentEvent } from '../../../packages/shared/src';
import { analyzeRootCause, correlateAnomalies } from '../../../packages/shared/src/analysis';
import { Storage } from './storage';

@Injectable()
export class IncidentService {
  private readonly mutations = new Map<string, Promise<Incident>>();
  constructor(@Inject(Storage) private readonly storage: Storage) {}
  /** Read, modify and persist together so concurrent fields do not overwrite each other. */
  private mutate(id: string, transform: (incident: Incident) => Incident) {
    const previous = this.mutations.get(id) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const updated = transform(this.find(id));
        await this.storage.saveIncident(updated);
        return updated;
      });
    this.mutations.set(id, next);
    const cleanup = () => {
      if (this.mutations.get(id) === next) this.mutations.delete(id);
    };
    void next.then(cleanup, cleanup);
    return next;
  }
  find(id: string) {
    const incident = this.storage.snapshot().incidents.find((i) => i.id === id);
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }
  validateServices(ids: string[], environment: string) {
    const services = this.storage.snapshot().services;
    if (ids.some((id) => !services.some((s) => s.id === id && s.environment === environment)))
      throw new BadRequestException('Select services in the incident environment');
  }
  async create(
    input: Pick<Incident, 'title' | 'severity' | 'serviceIds' | 'environment' | 'owner'>,
  ) {
    this.validateServices(input.serviceIds, input.environment);
    const now = new Date().toISOString();
    const incident: Incident = {
      ...input,
      id: `INC-${randomUUID().slice(0, 8).toUpperCase()}`,
      status: 'Investigating',
      startedAt: now,
      resolvedAt: null,
      rootCause: 'Awaiting telemetry',
      summary: 'Manually declared incident. Add investigation notes as evidence becomes available.',
      analysis: {
        candidates: [],
        recommendation: 'Collect telemetry from affected services to begin analysis.',
        calculatedAt: now,
        methodVersion: 'weighted-evidence-v1',
      },
    };
    await this.storage.saveIncident(incident);
    return incident;
  }
  async update(id: string, patch: Partial<Pick<Incident, 'status' | 'owner'>>) {
    return this.mutate(id, (current) => {
      const incident = { ...current, ...patch };
      if (patch.status)
        incident.resolvedAt =
          patch.status === 'Resolved'
            ? new Date(Math.max(Date.now(), Date.parse(incident.startedAt))).toISOString()
            : null;
      return incident;
    });
  }
  async analyze(id: string) {
    return this.mutate(id, (incident) => {
      const data = this.storage.snapshot();
      const anomalies = data.events
        .filter((e) => e.incidentId === id && e.magnitude > 0)
        .map((e) => ({ ...e, environment: incident.environment }));
      const analysis = analyzeRootCause(
        anomalies,
        data.dependencies,
        data.services,
        new Date().toISOString(),
      );
      return {
        ...incident,
        analysis,
        rootCause: analysis.candidates[0]?.title ?? 'Awaiting telemetry',
      };
    });
  }
  async ingest(events: Anomaly[]) {
    const data = this.storage.snapshot();
    for (const e of events) this.validateServices([e.serviceId], e.environment);
    const known = new Set(data.events.map((e) => e.id));
    const fresh = [
      ...new Map(events.filter((e) => !known.has(e.id)).map((e) => [e.id, e])).values(),
    ];
    const groups = correlateAnomalies(fresh, data.dependencies);
    const results: Incident[] = [];
    for (const group of groups) {
      const analysis = analyzeRootCause(
        group,
        data.dependencies,
        data.services,
        new Date().toISOString(),
      );
      const root = analysis.candidates[0];
      const incident: Incident = {
        id: `INC-${randomUUID().slice(0, 8).toUpperCase()}`,
        title: `${data.services.find((s) => s.id === root?.serviceId)?.name ?? 'Service'} degradation`,
        status: 'Investigating',
        severity: group.some((e) => e.magnitude >= 0.9) ? 'SEV-1' : 'SEV-2',
        startedAt: group[0].timestamp,
        resolvedAt: null,
        serviceIds: [...new Set(group.map((e) => e.serviceId))],
        environment: group[0].environment,
        owner: 'Alex Morgan',
        rootCause: root?.title ?? 'Unknown',
        summary: `${group.length} related anomalies detected within a two-minute window.`,
        analysis,
      };
      const incidentEvents: IncidentEvent[] = group.map((e) => ({
        id: e.id,
        incidentId: incident.id,
        timestamp: e.timestamp,
        serviceId: e.serviceId,
        type: e.severity === 'critical' ? 'error' : 'metric',
        severity: e.severity,
        description: e.description,
        metric: e.metric,
        correlation: Math.round((root?.score ?? 0) * 100),
        magnitude: e.magnitude,
      }));
      await this.storage.saveIncident(incident, incidentEvents);
      results.push(incident);
    }
    return { accepted: fresh.length, duplicates: events.length - fresh.length, incidents: results };
  }
}
