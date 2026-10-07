import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  annotationSchema,
  createIncidentSchema,
  ingestSchema,
  matchesQuery,
  updateIncidentSchema,
} from '../../../packages/shared/src';
import { Storage } from './storage';
import { IncidentService } from './incident-service';
import { SessionGuard, Public, issueSession, validSession, revokeSession } from './auth';
import { config } from './config';
import { ReadCache } from './cache';
import { InProcessEventProcessor } from './event-processor';
const querySchema = z.object({
  environment: z.enum(['production', 'staging']).default('production'),
  q: z.string().max(300).default(''),
  service: z.string().default('all'),
  level: z.enum(['all', 'ERROR', 'WARN', 'INFO', 'DEBUG']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  range: z.enum(['15m', '1h', '6h', '24h']).default('1h'),
});
function parse<T extends z.ZodType<unknown, z.ZodTypeDef, unknown>>(
  schema: T,
  value: unknown,
): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  return result.data;
}

@Controller('api')
export class ApiController {
  constructor(
    @Inject(Storage) private readonly storage: Storage,
    @Inject(IncidentService) private readonly incidents: IncidentService,
    @Inject(ReadCache) private readonly cache: ReadCache,
    @Inject(InProcessEventProcessor) private readonly processor: InProcessEventProcessor,
  ) {}
  @Public() @Get('health') health() {
    return { status: 'ok', storage: config.STORAGE_MODE, version: '1.0.1' };
  }
  @Public() @Get('auth/config') authConfig() {
    return { demoMode: config.DEMO_MODE };
  }
  @Public() @Post('auth/login') @HttpCode(200) login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = parse(
      z.object({ email: z.string().email().max(254), password: z.string().max(256) }),
      body,
    );
    const a = createHash('sha256').update(input.password).digest(),
      b = createHash('sha256').update(config.ADMIN_PASSWORD).digest();
    const validPassword = timingSafeEqual(a, b);
    if (input.email !== config.ADMIN_EMAIL || !validPassword)
      throw new UnauthorizedException('Invalid email or password');
    revokeSession((req.cookies as Record<string, unknown> | undefined)?.ig_session);
    res.cookie('ig_session', issueSession(), {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });
    return { name: 'Alex Morgan', email: input.email };
  }
  @Post('auth/logout') @HttpCode(200) logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    revokeSession((req.cookies as Record<string, unknown> | undefined)?.ig_session);
    res.clearCookie('ig_session', { path: '/' });
    return { ok: true };
  }
  @Public() @Get('auth/me') me(@Req() req: Request, @Res() res: Response) {
    return res.json(
      validSession((req.cookies as Record<string, unknown> | undefined)?.ig_session)
        ? { name: 'Alex Morgan', email: config.ADMIN_EMAIL }
        : null,
    );
  }
  @Get('bootstrap') bootstrap(@Query() query: unknown) {
    const q = parse(querySchema, query),
      d = this.storage.snapshot();
    const ids = new Set(d.services.filter((s) => s.environment === q.environment).map((s) => s.id));
    const incidents = d.incidents.filter((i) => i.environment === q.environment);
    return {
      services: d.services.filter((s) => ids.has(s.id)),
      dependencies: d.dependencies.filter((e) => ids.has(e.source)),
      incidents,
      events: d.events.filter((e) => incidents.some((i) => i.id === e.incidentId)),
      deployments: d.deployments.filter((e) => e.environment === q.environment),
      traces: d.traces.filter((t) => t.environment === q.environment),
      annotations: d.annotations.filter((a) => incidents.some((i) => i.id === a.incidentId)),
      demoTime: d.demoTime,
      storageMode: config.STORAGE_MODE,
      demoMode: config.DEMO_MODE,
      serviceTrends: Object.fromEntries(
        d.services
          .filter((s) => ids.has(s.id))
          .map((s) => [
            s.id,
            d.metrics
              .filter((m) => m.serviceId === s.id)
              .slice(-20)
              .map((m) => m.latency),
          ]),
      ),
    };
  }
  @Get('incidents') list(@Query() query: unknown) {
    const q = parse(
      querySchema.extend({
        status: z.string().optional(),
        severity: z.string().optional(),
        from: z.string().datetime().optional(),
      }),
      query,
    );
    let rows = this.storage.snapshot().incidents.filter((i) => i.environment === q.environment);
    rows = rows.filter(
      (i) =>
        (!q.status || i.status === q.status) &&
        (!q.severity || i.severity === q.severity) &&
        (q.service === 'all' || i.serviceIds.includes(q.service)) &&
        matchesQuery(`${i.title} ${i.id} ${i.rootCause}`, q.q) &&
        (!q.from || i.startedAt >= q.from),
    );
    return {
      items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
      total: rows.length,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
  @Get('incidents/:id') detail(@Param('id') id: string) {
    const incident = this.incidents.find(id);
    const d = this.storage.snapshot();
    return {
      ...incident,
      events: d.events.filter((e) => e.incidentId === id),
      annotations: d.annotations.filter((e) => e.incidentId === id),
    };
  }
  @Post('incidents') @UseGuards(SessionGuard) create(@Body() body: unknown) {
    return this.incidents.create(parse(createIncidentSchema, body));
  }
  @Patch('incidents/:id') @UseGuards(SessionGuard) update(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.incidents.update(id, parse(updateIncidentSchema, body));
  }
  @Post('incidents/:id/analyze') @UseGuards(SessionGuard) analyze(@Param('id') id: string) {
    return this.incidents.analyze(id);
  }
  @Post('incidents/:id/annotations') @UseGuards(SessionGuard) async annotate(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    this.incidents.find(id);
    const { body: text } = parse(annotationSchema, body);
    const note = {
      id: randomUUID(),
      incidentId: id,
      author: 'Alex Morgan',
      body: text,
      createdAt: new Date().toISOString(),
    };
    await this.storage.addAnnotation(note);
    return note;
  }
  @Post('ingest') @UseGuards(SessionGuard) ingest(@Body() body: unknown) {
    return this.processor.process(parse(ingestSchema, body).events);
  }
  @Get('logs') logs(@Query() query: unknown) {
    const q = parse(querySchema, query);
    const rows = this.storage
      .snapshot()
      .logs.filter(
        (l) =>
          l.environment === q.environment &&
          (q.service === 'all' || l.serviceId === q.service) &&
          (q.level === 'all' || l.level === q.level) &&
          matchesQuery(`${l.message} ${l.traceId} ${l.serviceId}`, q.q),
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const histogram = Array.from({ length: 36 }, (_, i) => {
      const start = Date.parse(this.storage.snapshot().demoTime) - 18 * 60000 + i * 30000;
      const bucket = rows.filter(
        (l) => Date.parse(l.timestamp) >= start && Date.parse(l.timestamp) < start + 30000,
      );
      return {
        timestamp: new Date(start).toISOString(),
        count: bucket.length,
        errors: bucket.filter((l) => l.level === 'ERROR').length,
      };
    });
    return {
      histogram,
      items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
      total: rows.length,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
  @Get('metrics') metrics(@Query() query: unknown) {
    const q = parse(querySchema, query);
    return this.cache.remember(`metrics:${q.environment}:${q.service}:${q.range}`, () => {
      const d = this.storage.snapshot();
      const minutes = { '15m': 15, '1h': 60, '6h': 360, '24h': 1440 }[q.range];
      const start = Date.parse(d.demoTime) - minutes * 60000;
      const rows = d.metrics.filter(
        (m) =>
          m.environment === q.environment &&
          (q.service === 'all' || m.serviceId === q.service) &&
          Date.parse(m.timestamp) >= start,
      );
      if (q.service !== 'all') return rows;
      const grouped = new Map<string, typeof rows>();
      for (const row of rows) {
        const bucket = grouped.get(row.timestamp) ?? [];
        bucket.push(row);
        grouped.set(row.timestamp, bucket);
      }
      return [...grouped].map(([timestamp, b]) => ({
        timestamp,
        latency: Math.round(
          b.reduce((sum, m) => sum + m.latency * m.rps, 0) /
            Math.max(
              1,
              b.reduce((sum, m) => sum + m.rps, 0),
            ),
        ),
        errorRate: Number(
          (
            b.reduce((sum, m) => sum + m.errorRate * m.rps, 0) /
            Math.max(
              1,
              b.reduce((sum, m) => sum + m.rps, 0),
            )
          ).toFixed(2),
        ),
        rps: b.reduce((sum, m) => sum + m.rps, 0),
        cpu: Math.round(b.reduce((sum, m) => sum + m.cpu, 0) / b.length),
        memory: Math.round(b.reduce((sum, m) => sum + m.memory, 0) / b.length),
        connections: b.find((m) => m.serviceId.includes('postgres-main'))?.connections ?? 0,
        cacheHit: b.find((m) => m.serviceId.endsWith('redis'))?.cacheHit ?? 0,
      }));
    });
  }
  @Get('search') search(@Query() query: unknown) {
    const q = parse(querySchema, query);
    if (!q.q.trim()) return [];
    const d = this.storage.snapshot();
    return [
      ...d.incidents
        .filter((i) => i.environment === q.environment && matchesQuery(`${i.title} ${i.id}`, q.q))
        .map((i) => ({
          id: i.id,
          label: i.title,
          type: 'Incident',
          href: `/app/incidents/${i.id}`,
        })),
      ...d.services
        .filter((s) => s.environment === q.environment && matchesQuery(s.name, q.q))
        .map((s) => ({
          id: s.id,
          label: s.name,
          type: 'Service',
          href: `/app/services?service=${s.id}`,
        })),
      ...d.traces
        .filter(
          (t) => t.environment === q.environment && matchesQuery(`${t.id} ${t.operation}`, q.q),
        )
        .slice(0, 5)
        .map((t) => ({ id: t.id, label: t.id, type: 'Trace', href: `/app/traces?trace=${t.id}` })),
      ...d.logs
        .filter((l) => l.environment === q.environment && matchesQuery(l.message, q.q))
        .slice(0, 3)
        .map((l) => ({
          id: l.id,
          label: l.message,
          type: 'Log',
          href: `/app/logs?q=${encodeURIComponent(q.q)}`,
        })),
    ].slice(0, 15);
  }
}
