'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  GitBranch,
  MessageSquare,
  Network,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import type { IncidentEvent } from '@incidentgraph/shared';
import { Badge, EmptyState, Panel } from './ui/primitives';
import { Dialog } from './ui/dialog';
import { clock } from '@/lib/utils';
export function IncidentTimeline({ events }: { events: IncidentEvent[] }) {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<IncidentEvent | null>(null);
  const filtered = events.filter((e) => filter === 'all' || e.type === filter);
  return (
    <>
      <Panel
        title="Incident timeline"
        description="Correlated signals, in the order they happened"
        action={
          <select
            className="compact-select"
            aria-label="Timeline event type"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All events</option>
            <option value="metric">Metrics</option>
            <option value="error">Errors</option>
            <option value="deployment">Deployments</option>
            <option value="analysis">Analysis</option>
          </select>
        }
      >
        <div className="timeline">
          {filtered.length ? (
            filtered.map((event) => {
              const Icon =
                event.type === 'deployment'
                  ? GitBranch
                  : event.type === 'analysis'
                    ? Sparkles
                    : event.type === 'error'
                      ? TriangleAlert
                      : event.type === 'annotation'
                        ? MessageSquare
                        : Activity;
              return (
                <button
                  key={event.id}
                  className={`timeline-event timeline-${event.severity}`}
                  onClick={() => setSelected(event)}
                >
                  <span className="timeline-time mono">{clock(event.timestamp)}</span>
                  <span className="timeline-icon">
                    <Icon size={13} />
                  </span>
                  <span className="timeline-description">
                    <strong>{event.description}</strong>
                    <span>
                      <span className="mono">{event.serviceId}</span>
                      <span className="timeline-separator">·</span>
                      {event.metric}
                    </span>
                  </span>
                  <ArrowUpRight size={13} className="timeline-arrow" />
                </button>
              );
            })
          ) : (
            <EmptyState
              title="No events of this type"
              description="Select another event type to continue."
            />
          )}
        </div>
        <div className="timeline-footer">
          <Network size={13} />
          {events.filter((e) => e.magnitude > 0).length} anomalies correlated using temporal and
          dependency relationships
        </div>
      </Panel>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Event evidence"
        description={selected ? `${clock(selected.timestamp)} UTC · ${selected.serviceId}` : ''}
      >
        {selected && (
          <div className="event-detail">
            <Badge
              tone={
                selected.severity === 'critical'
                  ? 'red'
                  : selected.severity === 'warning'
                    ? 'amber'
                    : 'blue'
              }
            >
              {selected.severity} · {selected.type}
            </Badge>
            <h3>{selected.description}</h3>
            <div className="evidence-metric">
              <span>Observed signal</span>
              <strong>{selected.metric}</strong>
            </div>
            <div className="evidence-metric">
              <span>Correlation score</span>
              <strong>{selected.correlation}%</strong>
            </div>
            <p className="muted">
              {selected.type === 'deployment'
                ? 'Temporal proximity is a correlation signal. This deployment has not been established as the cause.'
                : 'This event is associated with the incident by its timing and position in the service dependency graph.'}
            </p>
            <Link
              href={`/app/logs?service=${selected.serviceId}`}
              className="button button-secondary"
            >
              Inspect service logs
              <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
      </Dialog>
    </>
  );
}
