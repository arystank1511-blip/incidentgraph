import { Activity, AlertTriangle, ArrowUpRight, Check, Circle, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: string;
  className?: string;
}) {
  return <span className={cn('badge', `badge-${tone}`, className)}>{children}</span>;
}
export function Status({ status }: { status: string }) {
  const resolved = ['Resolved', 'healthy', 'succeeded', 'ok'].includes(status);
  const warning = ['Monitoring', 'degraded', 'WARN'].includes(status);
  return (
    <span className={`status ${resolved ? 'text-green' : warning ? 'text-amber' : 'text-red'}`}>
      {resolved ? <Check size={12} /> : warning ? <Activity size={12} /> : <Circle size={10} />}
      <span>{status[0]?.toUpperCase() + status.slice(1)}</span>
    </span>
  );
}
export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge tone={severity === 'SEV-1' ? 'red' : severity === 'SEV-2' ? 'amber' : 'neutral'}>
      <AlertTriangle size={11} />
      {severity}
    </Badge>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('panel', className)}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function EmptyState({
  title = 'No results found',
  description = 'Try adjusting your filters or search query.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox size={28} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function LoadingState() {
  return (
    <div className="page-loading" role="status">
      <Loader2 className="spin" size={20} />
      <span>Loading telemetry…</span>
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="heading-actions">{actions}</div>
    </div>
  );
}
export function SmallLink({ children }: { children: ReactNode }) {
  return (
    <span className="small-link">
      {children}
      <ArrowUpRight size={14} />
    </span>
  );
}
