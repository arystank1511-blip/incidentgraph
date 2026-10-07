import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Annotation, Incident, IncidentEvent, Snapshot } from '../../../packages/shared/src';
import { createDemoSnapshot } from '../../../packages/shared/src/demo';
import { config } from './config';

export interface TelemetryRepository {
  snapshot(): Snapshot;
  saveIncident(incident: Incident, events?: IncidentEvent[]): Promise<void>;
  addAnnotation(annotation: Annotation): Promise<void>;
}
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function seedDatabase(db: PrismaClient, data: Snapshot): Promise<void> {
  await db.organization.upsert({
    where: { id: 'acme' },
    update: {},
    create: { id: 'acme', name: 'Acme Engineering' },
  });
  await db.user.upsert({
    where: { id: 'alex' },
    update: {},
    create: {
      id: 'alex',
      email: 'demo@incidentgraph.dev',
      name: 'Alex Morgan',
      organizationId: 'acme',
    },
  });
  await db.project.upsert({
    where: { id: 'commerce' },
    update: {},
    create: { id: 'commerce', name: 'Commerce platform', organizationId: 'acme' },
  });
  for (const name of ['production', 'staging'])
    await db.environment.upsert({
      where: { id: name },
      update: {},
      create: { id: name, name, projectId: 'commerce' },
    });
  for (const service of data.services)
    await db.service.upsert({
      where: { id: service.id },
      update: {},
      create: {
        id: service.id,
        name: service.name,
        environmentId: service.environment,
        payload: json(service),
      },
    });
  await db.serviceDependency.createMany({ data: data.dependencies, skipDuplicates: true });
  for (const incident of data.incidents) {
    const { analysis, environment, ...rest } = incident;
    await db.incident.upsert({
      where: { id: incident.id },
      update: {},
      create: {
        ...rest,
        environmentId: environment,
        analysis: {
          create: {
            calculatedAt: analysis.calculatedAt,
            methodVersion: analysis.methodVersion,
            payload: json(analysis),
          },
        },
      },
    });
  }
  await db.incidentEvent.createMany({
    data: data.events.map((e) => ({
      id: e.id,
      incidentId: e.incidentId,
      timestamp: e.timestamp,
      payload: json(e),
    })),
    skipDuplicates: true,
  });
  await db.logEntry.createMany({
    data: data.logs.map((l) => ({ ...l, context: json(l.context) })),
    skipDuplicates: true,
  });
  await db.metricPoint.createMany({
    data: data.metrics.map((m, i) => ({
      id: `metric-${i}`,
      timestamp: m.timestamp,
      serviceId: m.serviceId,
      environment: m.environment,
      payload: json(m),
    })),
    skipDuplicates: true,
  });
  for (const trace of data.traces) {
    const { spans, ...rest } = trace;
    await db.trace.upsert({
      where: { id: trace.id },
      update: {},
      create: {
        ...rest,
        spans: { create: spans.map((s) => ({ ...s, attributes: json(s.attributes) })) },
      },
    });
  }
  await db.deployment.createMany({
    data: data.deployments.map((d) => ({
      id: d.id,
      timestamp: d.timestamp,
      serviceId: d.serviceId,
      environment: d.environment,
      payload: json(d),
    })),
    skipDuplicates: true,
  });
  await db.annotation.createMany({ data: data.annotations, skipDuplicates: true });
}

/** Snapshot cache is bounded for this single-project MVP. PostgreSQL remains durable authority. */
@Injectable()
export class Storage implements TelemetryRepository, OnModuleInit, OnModuleDestroy {
  private data: Snapshot = createDemoSnapshot();
  private db: PrismaClient | null = null;
  private readonly path = resolve(
    config.DEMO_MODE
      ? '.data/public-demo.json'
      : (process.env.DEMO_DATA_PATH ?? '.data/snapshot.json'),
  );
  private writes: Promise<void> = Promise.resolve();
  async onModuleInit() {
    if (config.STORAGE_MODE === 'postgres') {
      this.db = new PrismaClient();
      await this.db.$connect();
      await seedDatabase(this.db, this.data);
      const [
        services,
        dependencies,
        incidents,
        events,
        logs,
        metrics,
        traces,
        deployments,
        annotations,
      ] = await Promise.all([
        this.db.service.findMany(),
        this.db.serviceDependency.findMany(),
        this.db.incident.findMany({ include: { analysis: true }, orderBy: { startedAt: 'desc' } }),
        this.db.incidentEvent.findMany({ orderBy: { timestamp: 'asc' } }),
        this.db.logEntry.findMany({ orderBy: { timestamp: 'desc' }, take: 10000 }),
        this.db.metricPoint.findMany({ orderBy: { timestamp: 'asc' }, take: 20000 }),
        this.db.trace.findMany({ include: { spans: { orderBy: { startMs: 'asc' } } }, take: 1000 }),
        this.db.deployment.findMany(),
        this.db.annotation.findMany(),
      ]);
      this.data = JSON.parse(
        JSON.stringify({
          demoTime: this.data.demoTime,
          services: services.map((s) => s.payload),
          dependencies,
          incidents: incidents.map(({ environmentId, analysis, ...i }) => ({
            ...i,
            environment: environmentId,
            analysis: analysis?.payload,
          })),
          events: events.map((e) => e.payload),
          logs,
          metrics: metrics.map((m) => m.payload),
          traces,
          deployments: deployments.map((d) => d.payload),
          annotations,
        }),
      ) as Snapshot;
    } else {
      try {
        this.data = JSON.parse(await readFile(this.path, 'utf8')) as Snapshot;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        await this.persist();
      }
    }
  }
  snapshot() {
    return this.data;
  }
  private async persist() {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(this.data), { mode: 0o600, flag: 'wx' });
    await rename(temporary, this.path);
  }
  private enqueue(task: () => Promise<void>) {
    const next = this.writes.then(task);
    this.writes = next.catch(() => undefined);
    return next;
  }
  async saveIncident(incident: Incident, events: IncidentEvent[] = []) {
    return this.enqueue(async () => {
      if (this.db) {
        const { analysis, environment, ...rest } = incident;
        await this.db.$transaction(async (tx) => {
          await tx.incident.upsert({
            where: { id: incident.id },
            create: { ...rest, environmentId: environment },
            update: { ...rest, environmentId: environment },
          });
          await tx.rootCauseAnalysis.upsert({
            where: { incidentId: incident.id },
            create: {
              incidentId: incident.id,
              calculatedAt: analysis.calculatedAt,
              methodVersion: analysis.methodVersion,
              payload: json(analysis),
            },
            update: { calculatedAt: analysis.calculatedAt, payload: json(analysis) },
          });
          await tx.incidentEvent.createMany({
            data: events.map((e) => ({
              id: e.id,
              incidentId: e.incidentId,
              timestamp: e.timestamp,
              payload: json(e),
            })),
            skipDuplicates: true,
          });
        });
      }
      const idx = this.data.incidents.findIndex((i) => i.id === incident.id);
      if (idx < 0) this.data.incidents.unshift(incident);
      else this.data.incidents[idx] = incident;
      const ids = new Set(this.data.events.map((e) => e.id));
      this.data.events.push(...events.filter((e) => !ids.has(e.id)));
      if (!this.db) await this.persist();
    });
  }
  async addAnnotation(annotation: Annotation) {
    return this.enqueue(async () => {
      if (this.db) await this.db.annotation.create({ data: annotation });
      this.data.annotations.push(annotation);
      if (!this.db) await this.persist();
    });
  }
  async onModuleDestroy() {
    await this.close();
  }
  async close() {
    await this.writes;
    await this.db?.$disconnect();
  }
}
