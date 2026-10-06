'use client';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  GitBranch,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import type { Service } from '@incidentgraph/shared';
import { durationMinutes } from '@incidentgraph/shared';
import { useBootstrap, useWorkspace } from '@/components/providers';
import { Button } from '@/components/ui/button';
import {
  Badge,
  EmptyState,
  LoadingState,
  PageHeading,
  Panel,
  SeverityBadge,
  SmallLink,
} from '@/components/ui/primitives';
import { MetricChart, Sparkline, type ChartPoint } from '@/components/metric-chart';
import { IncidentTable } from '@/components/incident-table';
import { CreateIncidentButton } from '@/components/shell';
import { ServiceInspector } from '@/components/service-inspector';
import { api, clock } from '@/lib/utils';
const ServiceGraph = dynamic(() => import('@/components/service-graph'), {
  ssr: false,
  loading: () => <div className="skeleton graph-compact" />,
});
export default function Overview() {
  const { data, isLoading, error, refetch } = useBootstrap();
  const { environment, notify } = useWorkspace();
  const [range, setRange] = useState('1h');
  const [service, setService] = useState<Service | null>(null);
  const { data: metrics = [] } = useQuery({
    queryKey: ['metrics', environment, range],
    queryFn: () => api<ChartPoint[]>(`/metrics?environment=${environment}&range=${range}`),
  });
  if (isLoading) return <LoadingState />;
  if (error || !data)
    return (
      <EmptyState
        title="Telemetry is unavailable"
        description={error?.message}
        action={<Button onClick={() => refetch()}>Reconnect</Button>}
      />
    );
  const active = data.incidents.filter((i) => i.status !== 'Resolved');
  const resolved = data.incidents.filter((i) => i.status === 'Resolved');
  const mttr = Math.round(
    resolved.reduce((n, i) => n + durationMinutes(i, data.demoTime), 0) /
      Math.max(1, resolved.length),
  );
  const degraded = data.services.filter((s) => s.status !== 'healthy');
  const daily = Array.from({ length: 7 }, (_, index) => {
    const time = new Date(Date.parse(data.demoTime) - (6 - index) * 86400000).toISOString();
    const occurred = data.incidents.filter((incident) => incident.startedAt <= time);
    const open = occurred.filter((incident) => !incident.resolvedAt || incident.resolvedAt > time);
    const closed = occurred.filter(
      (incident) => incident.resolvedAt && incident.resolvedAt <= time,
    );
    return {
      active: open.length,
      degraded: new Set(open.flatMap((incident) => incident.serviceIds)).size,
      mttr: Math.round(
        closed.reduce((sum, incident) => sum + durationMinutes(incident, time), 0) /
          Math.max(1, closed.length),
      ),
      total: occurred.length,
    };
  });
  const averageActiveDuration = Math.round(
    active.reduce((sum, incident) => sum + durationMinutes(incident, data.demoTime), 0) /
      Math.max(1, active.length),
  );
  const latest = metrics.at(-1);
  const lead = active[0];
  return (
    <>
      <PageHeading
        title="System overview"
        description="A clear view of your systems. A faster path to the cause."
        actions={
          <>
            <label className="time-range">
              <Clock3 size={14} />
              <select
                aria-label="Overview time range"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="15m">Last 15 minutes</option>
                <option value="1h">Last 1 hour</option>
                <option value="6h">Last 6 hours</option>
                <option value="24h">Last 24 hours</option>
              </select>
              <ChevronDown size={13} />
            </label>
            <Button
              size="icon"
              aria-label="Refresh overview"
              onClick={async () => {
                await refetch();
                notify('Snapshot refreshed. Demo clock: 14:50 UTC.');
              }}
            >
              <RefreshCw size={15} />
            </Button>
            <CreateIncidentButton />
          </>
        }
      />
      <div className={`system-health-banner ${active.length ? '' : 'banner-healthy'}`}>
        <div>
          <span className="health-banner-icon">
            {active.length ? <TriangleAlert size={17} /> : <Check size={17} />}
          </span>
          <strong>
            {active.length ? 'Some systems are experiencing issues' : 'All systems operational'}
          </strong>
          <span className="banner-description">
            {active.length
              ? `${active.length} active incidents affecting ${degraded.length} services`
              : 'All services are within their expected baselines'}
          </span>
        </div>
        <Link href="/app/incidents">
          View incidents
          <ArrowRight size={14} />
        </Link>
      </div>
      <div className="stat-grid">
        <Stat
          label="Active incidents"
          value={String(active.length).padStart(2, '0')}
          icon={TriangleAlert}
          detail={
            active.length
              ? `Avg duration ${averageActiveDuration} min · ${active.filter((i) => i.severity === 'SEV-1').length} critical`
              : 'No active incidents'
          }
          tone={active.length ? 'red' : 'green'}
          points={daily.map((day) => day.active)}
        />
        <Stat
          label="Degraded services"
          value={String(degraded.length).padStart(2, '0')}
          suffix={`/ ${data.services.length}`}
          icon={Box}
          detail={`${data.services.length - degraded.length} services operating normally`}
          tone="amber"
          points={daily.map((day) => day.degraded)}
        />
        <Stat
          label="Mean time to resolve"
          value={`${mttr}`}
          suffix="min"
          icon={Clock3}
          detail="Across resolved demo incidents"
          tone="green"
          points={daily.map((day) => day.mttr)}
        />
        <Stat
          label="Incidents this week"
          value={String(data.incidents.length)}
          icon={Activity}
          detail={`${resolved.length} resolved · ${active.length} in progress`}
          tone="green"
          points={daily.map((day) => day.total)}
        />
      </div>
      <div className="dashboard-middle">
        <Panel
          title="Error rate"
          action={
            <span className="chart-legend">
              <span className="legend-dot dot-red" /> All services
            </span>
          }
        >
          <div className="chart-value">
            <strong>
              {latest?.errorRate ?? '—'}
              <small>%</small>
            </strong>
            <Badge tone={active.length ? 'red' : 'green'}>
              {active.length ? <ArrowUpRight size={12} /> : <Check size={12} />}{' '}
              {active.length ? 'Above baseline' : 'Within baseline'}
            </Badge>
            <span className="muted">Request-weighted</span>
          </div>
          <MetricChart data={metrics} />
        </Panel>
        <Panel
          title="Request latency"
          action={
            <span className="chart-legend">
              <span className="legend-dot dot-amber" /> Weighted p95
            </span>
          }
        >
          <div className="chart-value">
            <strong>
              {latest?.latency ?? '—'}
              <small>ms</small>
            </strong>
            <span className="baseline-label">
              Baseline <span>{metrics[0]?.latency ?? '—'} ms</span>
            </span>
          </div>
          <MetricChart data={metrics} metric="latency" color="var(--amber)" unit="ms" />
        </Panel>
        <Panel
          title="Infrastructure health"
          action={
            <Link href="/app/services" aria-label="View infrastructure services">
              <ArrowUpRight size={15} />
            </Link>
          }
        >
          <div className="infrastructure-list">
            {[
              { label: 'CPU utilization', value: latest?.cpu ?? 0, unit: '%', icon: Activity },
              { label: 'Memory usage', value: latest?.memory ?? 0, unit: '%', icon: Box },
              {
                label: 'Database connections',
                value: latest?.connections ?? 0,
                unit: '%',
                icon: CircleAlert,
              },
              { label: 'Cache hit rate', value: latest?.cacheHit ?? 0, unit: '%', icon: GitBranch },
            ].map((item, i) => (
              <div className="infrastructure-item" key={item.label}>
                <div>
                  <item.icon size={14} />
                  <span>{item.label}</span>
                  <strong className={i === 2 && item.value > 90 ? 'text-red' : ''}>
                    {item.value}
                    {item.unit}
                  </strong>
                </div>
                <div className="progress-track">
                  <span
                    className={
                      i === 2 && item.value > 90 ? 'bg-red' : i === 3 ? 'bg-amber' : 'bg-muted'
                    }
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="panel-note">
            <span className="live-dot" /> {data.services.length} services reporting telemetry
          </div>
        </Panel>
      </div>
      <div className="dashboard-investigation">
        <Panel
          title="Service health map"
          description="Dependencies and the path of failure"
          action={
            <Link href="/app/service-map">
              <SmallLink>Open service map</SmallLink>
            </Link>
          }
        >
          <ServiceGraph
            services={data.services}
            dependencies={data.dependencies}
            compact
            onSelect={setService}
          />
        </Panel>
        <Panel
          className="root-preview"
          title="A signal through the noise"
          action={<Sparkles size={17} className="text-green" />}
        >
          {lead ? (
            <>
              <div className="root-preview-label">
                <SeverityBadge severity={lead.severity} />
                <span className="mono">{lead.id}</span>
              </div>
              <h3>{lead.rootCause}</h3>
              <p>{lead.summary}</p>
              <div className="confidence-row">
                <span>Root cause confidence</span>
                <strong>
                  {Math.round((lead.analysis.candidates[0]?.score ?? 0) * 100)}
                  <small>%</small>
                </strong>
              </div>
              <div className="confidence-track">
                <span style={{ width: `${(lead.analysis.candidates[0]?.score ?? 0) * 100}%` }} />
              </div>
              <Link href={`/app/incidents/${lead.id}`} className="root-preview-cta">
                Investigate incident
                <ArrowRight size={15} />
              </Link>
            </>
          ) : (
            <EmptyState
              title="No active investigations"
              description="New correlated anomalies will appear here."
            />
          )}
        </Panel>
      </div>
      <div className="dashboard-bottom">
        <Panel
          title="Recent incidents"
          action={
            <Link href="/app/incidents">
              <SmallLink>View all incidents</SmallLink>
            </Link>
          }
        >
          <IncidentTable incidents={data.incidents.slice(0, 4)} now={data.demoTime} compact />
        </Panel>
        <Panel
          title="Recent deployments"
          action={
            <Link href="/app/deployments" aria-label="View deployments">
              <ArrowUpRight size={15} />
            </Link>
          }
        >
          <div className="deployment-feed">
            {data.deployments
              .slice()
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
              .slice(0, 3)
              .map((d) => (
                <Link
                  href={`/app/deployments?service=${d.serviceId}`}
                  key={d.id}
                  className="deployment-feed-item"
                >
                  <span className="deploy-icon">
                    <GitBranch size={15} />
                  </span>
                  <div>
                    <strong>{d.serviceId}</strong>
                    <p>
                      <span className="mono">{d.version}</span>
                      <span>·</span>
                      {clock(d.timestamp).slice(0, 5)} UTC
                    </p>
                  </div>
                  <Check size={14} className="text-green" />
                </Link>
              ))}
            {!data.deployments.length && (
              <EmptyState
                title="No deployments"
                description="No releases recorded in this environment."
              />
            )}
          </div>
          <Link className="panel-bottom-link" href="/app/deployments">
            See what changed
            <ArrowRight size={13} />
          </Link>
        </Panel>
      </div>
      <ServiceInspector service={service} onClose={() => setService(null)} />
    </>
  );
}
function Stat({
  label,
  value,
  suffix,
  icon: Icon,
  detail,
  tone,
  points,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: typeof Activity;
  detail: string;
  tone: string;
  points: number[];
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        {label}
        <Icon size={16} />
      </div>
      <div className="stat-main">
        <strong>
          {value}
          <small>{suffix}</small>
        </strong>
        <Sparkline tone={tone} points={points} />
      </div>
      <div className="stat-detail">
        {tone === 'green' ? (
          <ArrowDownRight size={13} className="text-green" />
        ) : (
          <span className={`health-dot health-${tone === 'red' ? 'critical' : 'degraded'}`} />
        )}
        <span>{detail}</span>
      </div>
    </div>
  );
}
