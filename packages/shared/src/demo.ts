import type {
  Anomaly,
  Dependency,
  Incident,
  IncidentEvent,
  Service,
  Snapshot,
  Trace,
} from './index';
import { analyzeRootCause } from './analysis';

export const DEMO_TIME = '2026-09-13T14:50:00.000Z';
const at = (clock: string, day = 13) => `2026-09-${String(day).padStart(2, '0')}T${clock}.000Z`;
const names = [
  'web-app',
  'api-gateway',
  'auth-service',
  'user-service',
  'order-service',
  'payment-service',
  'notification-service',
  'inventory-service',
  'postgres-main',
  'redis',
  'payment-provider',
];
export function createDemoSnapshot(): Snapshot {
  const services: Service[] = names.map((name, i) => ({
    id: name,
    name,
    kind:
      name === 'postgres-main'
        ? 'database'
        : name === 'redis'
          ? 'cache'
          : name === 'payment-provider'
            ? 'external'
            : 'application',
    status: ['postgres-main', 'payment-service'].includes(name)
      ? 'critical'
      : ['api-gateway', 'order-service', 'redis'].includes(name)
        ? 'degraded'
        : 'healthy',
    latency: [42, 1248, 34, 28, 1150, 940, 18, 52, 810, 186, 124][i],
    rps: [1842, 2384, 843, 421, 682, 428, 218, 352, 932, 2410, 420][i],
    errorRate: [0.02, 8.42, 0.03, 0.01, 12.3, 23.8, 0, 0.02, 18.2, 0.8, 0.04][i],
    cpu: 27 + i * 4,
    memory: 35 + i * 3,
    team: i < 4 ? 'Platform' : i < 8 ? 'Commerce' : 'Infrastructure',
    environment: 'production',
  }));
  services.push(
    ...services.map((s) => ({
      ...s,
      id: `staging-${s.id}`,
      environment: 'staging' as const,
      status: 'healthy' as const,
      latency: Math.round(s.latency * 0.1),
      rps: Math.round(s.rps * 0.05),
      errorRate: 0.01,
    })),
  );
  const pairs = [
    ['web-app', 'api-gateway'],
    ['api-gateway', 'auth-service'],
    ['api-gateway', 'user-service'],
    ['api-gateway', 'order-service'],
    ['order-service', 'payment-service'],
    ['order-service', 'inventory-service'],
    ['order-service', 'redis'],
    ['payment-service', 'postgres-main'],
    ['payment-service', 'payment-provider'],
    ['payment-service', 'notification-service'],
    ['auth-service', 'redis'],
    ['user-service', 'postgres-main'],
  ];
  const dependencies: Dependency[] = pairs.map(([source, target]) => ({ source, target }));
  dependencies.push(
    ...dependencies.map((e) => ({ source: `staging-${e.source}`, target: `staging-${e.target}` })),
  );
  const raw: [string, string, string, string, number, IncidentEvent['type']][] = [
    [
      '14:31:42',
      'postgres-main',
      'Database connections rose to 90%',
      '90 / 100 connections',
      0.85,
      'metric',
    ],
    [
      '14:31:58',
      'postgres-main',
      'Connection pool reached 98% capacity',
      '98 / 100 connections',
      1,
      'metric',
    ],
    [
      '14:32:04',
      'payment-service',
      'Payment API latency increased',
      '+240% · p95 940 ms',
      0.9,
      'metric',
    ],
    [
      '14:32:05',
      'payment-service',
      'Connection acquisition timeouts detected',
      '+430% timeout rate',
      0.95,
      'error',
    ],
    [
      '14:32:07',
      'order-service',
      'Order processing failures increased',
      '+190% error rate',
      0.75,
      'error',
    ],
    [
      '14:32:10',
      'api-gateway',
      'HTTP 500 responses exceeded threshold',
      '+310% · 8.42% errors',
      0.7,
      'error',
    ],
    [
      '14:32:11',
      'api-gateway',
      'Incident automatically detected',
      'SEV-1 · 4 affected services',
      0,
      'analysis',
    ],
    [
      '14:32:18',
      'postgres-main',
      'Dependency chain correlated',
      '3 propagation hops',
      0,
      'analysis',
    ],
    [
      '14:32:22',
      'postgres-main',
      'Probable root cause identified',
      'PostgreSQL connection pool',
      0,
      'analysis',
    ],
    [
      '14:32:24',
      'postgres-main',
      'Evidence confidence reached 91%',
      '6 correlated anomalies',
      0,
      'analysis',
    ],
  ];
  const events: IncidentEvent[] = raw.map(
    ([clock, serviceId, description, metric, magnitude, type], i) => ({
      id: `evt-${i}`,
      incidentId: 'INC-1042',
      timestamp: at(clock),
      serviceId,
      type,
      severity: magnitude > 0.8 ? 'critical' : magnitude > 0.3 ? 'warning' : 'info',
      description,
      metric,
      correlation: magnitude ? Math.round((0.73 + magnitude * 0.18) * 100) : 91,
      magnitude,
    }),
  );
  events.unshift({
    id: 'evt-deploy',
    incidentId: 'INC-1042',
    timestamp: at('13:58:00'),
    serviceId: 'payment-service',
    type: 'deployment',
    severity: 'info',
    description: 'payment-service v2.4.1 deployed',
    metric: '34m before detection · Medium correlation',
    correlation: 36,
    magnitude: 0,
  });
  const anomalies: Anomaly[] = events
    .filter((e) => e.magnitude > 0)
    .map((e) => ({ ...e, environment: 'production' }));
  const analysis = analyzeRootCause(anomalies, dependencies, services, at('14:32:24'));
  const incidents: Incident[] = [
    {
      id: 'INC-1042',
      title: 'Payment failures',
      status: 'Investigating',
      severity: 'SEV-1',
      startedAt: at('14:31:42'),
      resolvedAt: null,
      serviceIds: ['postgres-main', 'payment-service', 'order-service', 'api-gateway'],
      environment: 'production',
      owner: 'Alex Morgan',
      rootCause: analysis.candidates[0].title,
      summary:
        'Elevated payment timeouts are propagating through checkout. PostgreSQL connection pool exhaustion is the leading hypothesis.',
      analysis,
    },
  ];
  const history = [
    ['Checkout latency', 'Redis saturation', 'redis', 'Monitoring', 'SEV-2'],
    [
      'Authentication failures after deployment',
      'Auth deployment regression',
      'auth-service',
      'Resolved',
      'SEV-2',
    ],
    [
      'Inventory sync delays',
      'Consumer lag on stock updates',
      'inventory-service',
      'Resolved',
      'SEV-3',
    ],
    ['Elevated gateway errors', 'Upstream connection resets', 'api-gateway', 'Resolved', 'SEV-2'],
    [
      'Notification delivery lag',
      'Email provider rate limiting',
      'notification-service',
      'Resolved',
      'SEV-3',
    ],
    ['Database replica lag', 'Long-running report query', 'postgres-main', 'Resolved', 'SEV-2'],
    ['User profile timeouts', 'Missing query index', 'user-service', 'Resolved', 'SEV-3'],
    ['Cache eviction spike', 'Memory pressure', 'redis', 'Resolved', 'SEV-3'],
    [
      'Payment provider latency',
      'Provider response degradation',
      'payment-provider',
      'Resolved',
      'SEV-2',
    ],
    ['Session refresh errors', 'Token rotation mismatch', 'auth-service', 'Resolved', 'SEV-3'],
    [
      'Stock reservation conflicts',
      'Concurrent write contention',
      'inventory-service',
      'Resolved',
      'SEV-4',
    ],
  ];
  history.forEach(([title, rootCause, serviceId, status, severity], i) => {
    const day = 13 - Math.floor(i / 2);
    const start =
      i === 0 ? at('14:18:00') : at(`${String(9 + (i % 4)).padStart(2, '0')}:12:00`, day);
    const ev: IncidentEvent = {
      id: `evt-history-${i}`,
      incidentId: `INC-${1041 - i}`,
      timestamp: start,
      serviceId,
      type: 'metric',
      severity: 'warning',
      description: rootCause,
      metric: i === 0 ? 'Redis p95 186 ms' : 'Threshold exceeded',
      correlation: 82,
      magnitude: 0.8,
    };
    events.push(ev);
    incidents.push({
      id: ev.incidentId,
      title,
      status: status as Incident['status'],
      severity: severity as Incident['severity'],
      startedAt: start,
      resolvedAt:
        status === 'Resolved'
          ? new Date(Date.parse(start) + (14 + i * 3) * 60000).toISOString()
          : null,
      serviceIds: i === 0 ? ['redis', 'order-service'] : [serviceId],
      environment: 'production',
      owner: ['Jamie Chen', 'Sarah Lee', 'Alex Morgan'][i % 3],
      rootCause,
      summary: `${title}. Investigation evidence points to ${rootCause.toLowerCase()}.`,
      analysis: analyzeRootCause(
        [{ ...ev, environment: 'production' }],
        dependencies,
        services,
        start,
      ),
    });
  });
  const deployments = names.slice(0, 8).map((serviceId, i) => ({
    id: `dep-${i}`,
    serviceId,
    environment: 'production' as const,
    version: serviceId === 'payment-service' ? 'v2.4.1' : `v2.${4 - (i % 3)}.${i + 1}`,
    commit: ['8f3a21c', 'd97b08a', '2ca14f9', '6b82d01'][i % 4],
    author: ['Alex Morgan', 'Jamie Chen', 'Sarah Lee'][i % 3],
    timestamp: at(i === 5 ? '13:58:00' : `${String(13 - i).padStart(2, '0')}:24:00`),
    status: 'succeeded' as const,
    correlation: i === 5 ? ('Medium' as const) : ('Low' as const),
  }));
  const traces = Array.from({ length: 32 }, (_, i): Trace => ({
    id: `a7f9c2e4b1d0836a9275c4f0e162bd${String(i).padStart(2, '0')}`,
    timestamp: new Date(Date.parse(at('14:32:05')) + i * 24000).toISOString(),
    environment: 'production' as const,
    operation: 'POST /api/checkout',
    duration: 1248 + i * 7,
    status: i % 4 === 3 ? ('ok' as const) : ('error' as const),
    spans: [
      {
        id: `d4e901ab${String(i).padStart(6, '0')}00`,
        parentId: null,
        serviceId: 'api-gateway',
        operation: 'POST /api/checkout',
        startMs: 0,
        duration: 1248 + i * 7,
        status: i % 4 === 3 ? ('ok' as const) : ('error' as const),
        attributes: { 'http.status_code': i % 4 === 3 ? 200 : 500 },
      },
      {
        id: `d4e901ab${String(i).padStart(6, '0')}01`,
        parentId: `d4e901ab${String(i).padStart(6, '0')}00`,
        serviceId: 'order-service',
        operation: 'createOrder',
        startMs: 34,
        duration: 1150 + i * 7,
        status: 'error' as const,
        attributes: { 'order.id': `ord_9${i}a8` },
      },
      {
        id: `d4e901ab${String(i).padStart(6, '0')}02`,
        parentId: `d4e901ab${String(i).padStart(6, '0')}01`,
        serviceId: 'payment-service',
        operation: 'processPayment',
        startMs: 95,
        duration: 940 + i * 7,
        status: 'error' as const,
        attributes: { 'rpc.system': 'grpc' },
      },
      {
        id: `d4e901ab${String(i).padStart(6, '0')}03`,
        parentId: `d4e901ab${String(i).padStart(6, '0')}02`,
        serviceId: 'postgres-main',
        operation: 'acquire connection · SELECT',
        startMs: 150,
        duration: 810 + i * 7,
        status: 'error' as const,
        attributes: {
          'db.system': 'postgresql',
          'db.pool.wait_ms': 810 + i * 7,
          'db.statement': 'SELECT id, amount FROM payments WHERE order_id = $1',
        },
      },
    ],
  }));
  for (const trace of traces)
    if (trace.status === 'ok') for (const span of trace.spans) span.status = 'ok';
  const messages = [
    'Connection pool timeout: unable to acquire client after 5000ms',
    'Payment processing failed: database connection unavailable',
    'Upstream request failed: payment-service deadline exceeded',
    'HTTP 500 POST /api/checkout: upstream timeout',
    'Connection utilization above threshold: 98/100',
    'Health check completed successfully',
    'Retry scheduled with exponential backoff',
  ];
  const logs = Array.from({ length: 360 }, (_, i) => ({
    id: `log-${i}`,
    timestamp: new Date(Date.parse(at('14:31:42')) + i * 3000).toISOString(),
    level: i % 7 < 4 ? ('ERROR' as const) : i % 7 === 5 ? ('INFO' as const) : ('WARN' as const),
    serviceId: [
      'payment-service',
      'payment-service',
      'order-service',
      'api-gateway',
      'postgres-main',
      'auth-service',
      'payment-service',
    ][i % 7],
    environment: 'production' as const,
    message: messages[i % 7],
    traceId: traces[i % traces.length].id,
    context: {
      'db.system': 'postgresql',
      duration: i % 7 < 4 ? 5000 + (i % 235) : 28,
      'pool.active': 98,
      'pool.max': 100,
      retry: i % 3,
      region: 'eu-west-1',
    },
  }));
  const metrics = services.flatMap((service, si) =>
    Array.from({ length: 289 }, (_, i) => {
      const incident =
        service.environment === 'production' && service.status !== 'healthy' && i > 284;
      const wave = Math.sin(i * 0.83 + si) * 0.5 + Math.sin(i * 0.23) * 0.3;
      return {
        timestamp: new Date(Date.parse(DEMO_TIME) - (288 - i) * 300000).toISOString(),
        serviceId: service.id,
        environment: service.environment,
        latency: Math.round(
          (incident ? service.latency : service.latency * 0.12) * (1 + wave * 0.2),
        ),
        errorRate: Number(
          (incident ? service.errorRate * (1 + wave * 0.15) : 0.04 + Math.abs(wave) * 0.08).toFixed(
            2,
          ),
        ),
        rps: Math.round(service.rps * (1 + wave * 0.15)),
        cpu: Math.round(service.cpu * (1 + wave * 0.12)),
        memory: Math.round(service.memory * (1 + wave * 0.04)),
        connections: incident && service.kind === 'database' ? 98 : Math.round(60 + wave * 8),
        cacheHit: incident && service.kind === 'cache' ? 76 : Math.round(96 + wave * 2),
      };
    }),
  );
  return {
    services,
    dependencies,
    incidents,
    events,
    logs,
    metrics,
    traces,
    deployments,
    annotations: [
      {
        id: 'note-1',
        incidentId: 'INC-1042',
        author: 'Alex Morgan',
        body: 'Investigating long-running queries on postgres-main. Pool utilization is holding at 98%; no evidence of a payment provider outage.',
        createdAt: at('14:36:12'),
      },
    ],
    demoTime: DEMO_TIME,
  };
}
