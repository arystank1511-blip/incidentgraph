'use client';
import { useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpRight,
  Box,
  Clock3,
  Copy,
  GitBranch,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import type {
  Annotation,
  Incident,
  IncidentEvent,
  IncidentStatus,
  Service,
} from '@incidentgraph/shared';
import { durationMinutes, incidentStates } from '@incidentgraph/shared';
import { api, clock, dateLabel, initials } from '@/lib/utils';
import { useBootstrap, useWorkspace, useHydrated } from '@/components/providers';
import {
  Badge,
  EmptyState,
  LoadingState,
  Panel,
  SeverityBadge,
  Status,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { IncidentTimeline } from '@/components/incident-timeline';
import { RootCausePanel } from '@/components/root-cause-panel';
import { ServiceInspector } from '@/components/service-inspector';
const ServiceGraph = dynamic(() => import('@/components/service-graph'), {
  ssr: false,
  loading: () => <div className="skeleton graph-compact" />,
});
type Detail = Incident & { events: IncidentEvent[]; annotations: Annotation[] };
export default function IncidentDetail() {
  const hydrated = useHydrated();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => api<Detail>(`/incidents/${id}`),
  });
  const { data: bootstrap } = useBootstrap();
  const { notify, environment } = useWorkspace();
  const client = useQueryClient();
  const [tab, setTab] = useState('Investigation'),
    [service, setService] = useState<Service | null>(null),
    [busy, setBusy] = useState(false),
    [noteError, setNoteError] = useState('');
  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      await api(path, { method, body: body ? JSON.stringify(body) : undefined });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['incident', id] }),
        client.invalidateQueries({ queryKey: ['bootstrap'] }),
        client.invalidateQueries({ queryKey: ['incidents'] }),
      ]);
      notify('Investigation updated.');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setNoteError('');
    setBusy(true);
    try {
      await api(`/incidents/${id}/annotations`, {
        method: 'POST',
        body: JSON.stringify({ body: new FormData(form).get('body') }),
      });
      await client.invalidateQueries({ queryKey: ['incident', id] });
      form.reset();
      notify('Note added to the investigation.');
    } catch (e) {
      setNoteError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!hydrated) return <LoadingState />;
  if (isLoading) return <LoadingState />;
  if (error || !data)
    return (
      <EmptyState
        title="Incident unavailable"
        description={error?.message}
        action={
          <Link className="button button-secondary" href="/app/incidents">
            Back to incidents
          </Link>
        }
      />
    );
  if (data.environment !== environment)
    return (
      <EmptyState
        title={`This incident belongs to ${data.environment}`}
        description="Switch the environment in the top bar to view its telemetry."
      />
    );
  return (
    <>
      <Link href="/app/incidents" className="back-link">
        <ArrowLeft size={13} />
        All incidents
      </Link>
      <div className="incident-detail-heading">
        <div>
          <div className="incident-heading-meta">
            <SeverityBadge severity={data.severity} />
            <span className="mono muted">{data.id}</span>
            <Badge>{data.environment}</Badge>
          </div>
          <h1>{data.title}</h1>
          <p>{data.summary}</p>
        </div>
        <div className="heading-actions">
          <Button
            size="icon"
            aria-label="Copy incident link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                notify('Incident link copied.');
              } catch {
                notify('Copy the incident URL from your browser.');
              }
            }}
          >
            <Copy size={14} />
          </Button>
          <Button disabled={busy} onClick={() => mutate(`/incidents/${id}/analyze`, 'POST')}>
            <RefreshCw size={14} className={busy ? 'spin' : ''} />
            Re-run analysis
          </Button>
          <label className="status-picker">
            <select
              aria-label="Incident status"
              disabled={busy}
              value={data.status}
              onChange={(e) =>
                mutate(`/incidents/${id}`, 'PATCH', { status: e.target.value as IncidentStatus })
              }
            >
              {incidentStates.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="incident-summary-strip">
        <div>
          <span>STATUS</span>
          <Status status={data.status} />
        </div>
        <div>
          <span>STARTED</span>
          <strong>
            <Clock3 size={12} />
            {dateLabel(data.startedAt)}, {clock(data.startedAt).slice(0, 5)} UTC
          </strong>
        </div>
        <div>
          <span>DURATION</span>
          <strong>
            {durationMinutes(data, bootstrap?.demoTime ?? new Date().toISOString())} min
          </strong>
        </div>
        <div>
          <span>INCIDENT COMMANDER</span>
          <label className="owner-picker">
            <span className="avatar avatar-small">{initials(data.owner)}</span>
            <select
              aria-label="Incident commander"
              value={data.owner}
              disabled={busy}
              onChange={(e) => mutate(`/incidents/${id}`, 'PATCH', { owner: e.target.value })}
            >
              {['Alex Morgan', 'Jamie Chen', 'Sarah Lee'].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <span>AFFECTED SERVICES</span>
          <strong>
            <Box size={13} />
            {data.serviceIds.length} services
          </strong>
        </div>
      </div>
      <div className="view-tabs detail-tabs">
        {['Investigation', 'Timeline', 'Activity'].map((t) => (
          <button key={t} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>
            {t}
            {t === 'Timeline' && <span>{data.events.length}</span>}
            {t === 'Activity' && <span>{data.annotations.length}</span>}
          </button>
        ))}
        <div className="detail-tab-links">
          <Link
            href={`/app/logs?service=${data.serviceIds.includes('payment-service') ? 'payment-service' : data.serviceIds[0]}`}
          >
            View logs
            <ArrowUpRight size={12} />
          </Link>
          <Link href="/app/traces">
            View traces
            <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
      {tab === 'Investigation' ? (
        <div className="investigation-grid">
          <div className="investigation-main">
            <Panel
              title="Failure propagation"
              description="The dependency path connects the symptoms to their source"
              action={
                <Link href="/app/service-map" className="small-link">
                  Full map
                  <ArrowUpRight size={13} />
                </Link>
              }
            >
              {bootstrap && (
                <ServiceGraph
                  services={bootstrap.services.filter((s) => data.serviceIds.includes(s.id))}
                  dependencies={bootstrap.dependencies}
                  compact
                  onSelect={setService}
                />
              )}
            </Panel>
            <IncidentTimeline events={data.events} />
            <Panel title="Deployment context" action={<GitBranch size={15} className="muted" />}>
              <div className="deployment-context">
                <div>
                  <Badge
                    tone={
                      data.events.some((event) => event.type === 'deployment') ? 'amber' : 'neutral'
                    }
                  >
                    {data.events.some((event) => event.type === 'deployment')
                      ? 'Medium correlation'
                      : 'No linked deployment'}
                  </Badge>
                  <Link href="/app/deployments">
                    Review changes
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
                <p>
                  {data.events.some((e) => e.type === 'deployment')
                    ? 'payment-service v2.4.1 was deployed 34 minutes before detection. The connection pool anomaly is more strongly supported than a deployment regression.'
                    : 'Review deployments around the incident start time. No causal deployment link has been established.'}
                </p>
                <small>Temporal proximity alone does not establish causation.</small>
              </div>
            </Panel>
          </div>
          <RootCausePanel analysis={data.analysis} />
        </div>
      ) : tab === 'Timeline' ? (
        <IncidentTimeline events={data.events} />
      ) : (
        <Panel
          title="Investigation activity"
          description="Leave context for the next engineer on call."
        >
          <div className="notes-list">
            {data.annotations.map((n) => (
              <article key={n.id} className="note">
                <span className="avatar">{initials(n.author)}</span>
                <div>
                  <header>
                    <strong>{n.author}</strong>
                    <time>
                      {dateLabel(n.createdAt)} · {clock(n.createdAt)} UTC
                    </time>
                  </header>
                  <p>{n.body}</p>
                </div>
              </article>
            ))}
            <form onSubmit={addNote} className="form-stack">
              <label>
                Add an investigation note
                <textarea
                  name="body"
                  required
                  maxLength={2000}
                  rows={4}
                  placeholder="What have you observed? Include evidence and next steps."
                />
              </label>
              {noteError && (
                <p className="form-error" role="alert">
                  {noteError}
                </p>
              )}
              <Button disabled={busy} variant="default" type="submit">
                <MessageSquare size={14} />
                {busy ? 'Saving…' : 'Add note'}
              </Button>
            </form>
          </div>
        </Panel>
      )}
      <ServiceInspector service={service} onClose={() => setService(null)} />
    </>
  );
}
