import { z } from 'zod';

export const environments = ['production', 'staging'] as const;
export type EnvironmentName = (typeof environments)[number];
export const incidentStates = ['Investigating', 'Identified', 'Monitoring', 'Resolved'] as const;
export type IncidentStatus = (typeof incidentStates)[number];
export type Severity = 'SEV-1' | 'SEV-2' | 'SEV-3' | 'SEV-4';
export type Health = 'healthy' | 'degraded' | 'critical';
export interface Service {
  id: string;
  name: string;
  kind: 'application' | 'database' | 'cache' | 'external';
  status: Health;
  latency: number;
  rps: number;
  errorRate: number;
  cpu: number;
  memory: number;
  team: string;
  environment: EnvironmentName;
}
export interface Dependency {
  source: string;
  target: string;
}
export interface IncidentEvent {
  id: string;
  incidentId: string;
  timestamp: string;
  serviceId: string;
  type: 'metric' | 'error' | 'deployment' | 'analysis' | 'annotation';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  metric: string;
  correlation: number;
  magnitude: number;
}
export interface Candidate {
  serviceId: string;
  title: string;
  score: number;
  evidence: string[];
  explanation: string;
  factors: { temporal: number; dependency: number; anomaly: number; propagation: number };
}
export interface Analysis {
  candidates: Candidate[];
  recommendation: string;
  calculatedAt: string;
  methodVersion: string;
}
export interface Incident {
  id: string;
  title: string;
  status: IncidentStatus;
  severity: Severity;
  startedAt: string;
  resolvedAt: string | null;
  serviceIds: string[];
  environment: EnvironmentName;
  owner: string;
  rootCause: string;
  summary: string;
  analysis: Analysis;
}
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  serviceId: string;
  environment: EnvironmentName;
  message: string;
  traceId: string;
  context: Record<string, string | number | boolean>;
}
export interface MetricPoint {
  timestamp: string;
  serviceId: string;
  environment: EnvironmentName;
  latency: number;
  errorRate: number;
  rps: number;
  cpu: number;
  memory: number;
  connections: number;
  cacheHit: number;
}
export interface Span {
  id: string;
  parentId: string | null;
  serviceId: string;
  operation: string;
  startMs: number;
  duration: number;
  status: 'ok' | 'error';
  attributes: Record<string, string | number>;
}
export interface Trace {
  id: string;
  timestamp: string;
  environment: EnvironmentName;
  operation: string;
  duration: number;
  status: 'ok' | 'error';
  spans: Span[];
}
export interface Deployment {
  id: string;
  serviceId: string;
  environment: EnvironmentName;
  version: string;
  commit: string;
  author: string;
  timestamp: string;
  status: 'succeeded' | 'rolled-back';
  correlation: 'Low' | 'Medium' | 'High';
}
export interface Annotation {
  id: string;
  incidentId: string;
  author: string;
  body: string;
  createdAt: string;
}
export interface Snapshot {
  services: Service[];
  dependencies: Dependency[];
  incidents: Incident[];
  events: IncidentEvent[];
  logs: LogEntry[];
  metrics: MetricPoint[];
  traces: Trace[];
  deployments: Deployment[];
  annotations: Annotation[];
  demoTime: string;
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export const createIncidentSchema = z.object({
  title: z.string().trim().min(5).max(180),
  severity: z.enum(['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4']),
  serviceIds: z.array(z.string()).min(1).max(20),
  environment: z.enum(environments),
  owner: z.string().trim().min(1).max(60).default('Alex Morgan'),
});
export const updateIncidentSchema = z
  .object({
    status: z.enum(incidentStates).optional(),
    owner: z.string().trim().min(1).max(60).optional(),
  })
  .refine((v) => v.status !== undefined || v.owner !== undefined, 'Provide status or owner');
export const annotationSchema = z.object({ body: z.string().trim().min(1).max(2000) });
export const ingestSchema = z.object({
  events: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        timestamp: z.string().datetime(),
        serviceId: z.string().min(1),
        environment: z.enum(environments),
        description: z.string().min(1).max(500),
        magnitude: z.number().min(0).max(1),
        metric: z.string().max(100),
        severity: z.enum(['info', 'warning', 'critical']),
      }),
    )
    .min(1)
    .max(100),
});
export type Anomaly = z.infer<typeof ingestSchema>['events'][number];
export function durationMinutes(incident: Incident, now: string): number {
  return Math.max(
    0,
    Math.round((Date.parse(incident.resolvedAt ?? now) - Date.parse(incident.startedAt)) / 60000),
  );
}
export function matchesQuery(message: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return (
    !q ||
    q
      .split(/\s+or\s+/)
      .some((group) =>
        group
          .split(/\s+and\s+/)
          .every((term) => message.toLowerCase().includes(term.replace(/^"|"$/g, ''))),
      )
  );
}
