'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, LogOut, ShieldCheck } from 'lucide-react';
import { useBootstrap, useWorkspace, useHydrated } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Badge, PageHeading, Panel, LoadingState } from '@/components/ui/primitives';
import { api } from '@/lib/utils';
export default function Settings() {
  const hydrated = useHydrated();
  const { environment, setEnvironment, notify } = useWorkspace();
  const { data } = useBootstrap();
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  if (!hydrated) return <LoadingState />;
  return (
    <>
      <PageHeading
        title="Workspace settings"
        description="Your organization, environment, and demo session."
      />
      <div className="settings-grid">
        <Panel title="Organization">
          <div className="settings-body">
            <div className="settings-org">
              <span className="workspace-avatar">A</span>
              <div>
                <h3>Acme Engineering</h3>
                <p>Commerce platform</p>
              </div>
              <Badge>Demo workspace</Badge>
            </div>
            <div className="settings-row">
              <span>Active environment</span>
              <select
                aria-label="Settings environment"
                value={environment}
                onChange={(e) => {
                  setEnvironment(e.target.value as typeof environment);
                  notify('Environment switched.');
                }}
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
              </select>
            </div>
            <div className="settings-row">
              <span>Storage backend</span>
              <strong>
                {data?.storageMode === 'postgres'
                  ? 'PostgreSQL / Prisma'
                  : 'Server-side demo snapshot'}
              </strong>
            </div>
            <div className="settings-row">
              <span>Telemetry clock</span>
              <strong>Sep 13, 2026 · 14:50 UTC</strong>
            </div>
            <p className="muted">
              Demo telemetry is a reproducible snapshot. Incident changes and notes persist across
              restarts.
            </p>
          </div>
        </Panel>
        <Panel title="Demo session" action={<ShieldCheck size={17} className="text-green" />}>
          <div className="settings-body">
            <h3>Alex Morgan</h3>
            <p>demo@incidentgraph.dev</p>
            <div className="info-banner">
              <Check size={16} />
              <span>Session cookies are HTTP-only. Writes require authentication.</span>
            </div>
            <Link className="button button-primary" href="/login">
              Sign in to the demo
              <ArrowUpRight size={14} />
            </Link>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api('/auth/logout', { method: 'POST' });
                  await client.cancelQueries();
                  client.clear();
                  window.location.replace('/login');
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <LogOut size={14} />
              Sign out
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}
