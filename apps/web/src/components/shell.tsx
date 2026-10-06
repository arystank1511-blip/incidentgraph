'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Box,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  Command,
  GitBranch,
  Layers3,
  LayoutDashboard,
  Menu,
  Network,
  Plus,
  Search,
  Settings2,
  Terminal,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useBootstrap, useWorkspace } from './providers';
import { CommandPalette } from './command-palette';
import { CreateIncident } from './create-incident';
import { Button } from './ui/button';
import { api } from '@/lib/utils';
const nav = [
  { name: 'Overview', href: '/app/overview', icon: LayoutDashboard },
  { name: 'Incidents', href: '/app/incidents', icon: TriangleAlert },
  { name: 'Services', href: '/app/services', icon: Box },
  { name: 'Service map', href: '/app/service-map', icon: Network },
  { name: 'Logs', href: '/app/logs', icon: Terminal },
  { name: 'Metrics', href: '/app/metrics', icon: Activity },
  { name: 'Traces', href: '/app/traces', icon: AudioLines },
  { name: 'Deployments', href: '/app/deployments', icon: GitBranch },
];
export function Logo() {
  return (
    <span className="brand">
      <span className="logo-symbol">
        <Network size={19} strokeWidth={2.2} />
      </span>
      incident<span className="brand-light">graph</span>
    </span>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [command, setCommand] = useState(false),
    [create, setCreate] = useState(false),
    [mobile, setMobile] = useState(false);
  const { environment, setEnvironment } = useWorkspace();
  const { data } = useBootstrap();
  const { data: user } = useQuery({
    queryKey: ['session'],
    queryFn: () => api<{ name: string }>('/auth/me'),
    retry: false,
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommand((v) => !v);
      }
      if (e.key === 'Escape') setMobile(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const current = nav.find((n) => path.startsWith(n.href));
  const active = data?.incidents.filter((i) => i.status !== 'Resolved').length ?? 0;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'sidebar-open' : ''}`}>
        <Link href="/" className="brand-link">
          <Logo />
        </Link>
        <button className="workspace-switcher" onClick={() => setCommand(true)}>
          <span className="workspace-avatar">A</span>
          <span>
            <strong>Acme Engineering</strong>
            <small>Commerce platform</small>
          </span>
          <ChevronsUpDown size={14} />
        </button>
        <button className="sidebar-search" onClick={() => setCommand(true)}>
          <Search size={15} />
          <span>Search anything…</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((item, index) => (
            <Link
              onClick={() => setMobile(false)}
              key={item.href}
              href={item.href}
              aria-current={path.startsWith(item.href) ? 'page' : undefined}
              className={`nav-item ${path.startsWith(item.href) ? 'active' : ''} ${index === 4 ? 'nav-separator' : ''}`}
            >
              <item.icon size={17} />
              <span>{item.name}</span>
              {item.name === 'Incidents' && active > 0 && (
                <span className="nav-count">{active}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <span className="demo-card-icon">
              <Layers3 size={17} />
            </span>
            <strong>Your investigation sandbox</strong>
            <p>Realistic telemetry. A complete incident story.</p>
            <Link href="/architecture">
              Explore the architecture <ArrowUpRight size={13} />
            </Link>
          </div>
          <Link href="/architecture" className="nav-item">
            <BookOpen size={17} />
            <span>Documentation</span>
            <ArrowUpRight size={13} />
          </Link>
          <Link
            href="/app/settings"
            className={`nav-item ${path.includes('settings') ? 'active' : ''}`}
          >
            <Settings2 size={17} />
            <span>Settings</span>
          </Link>
          <Link href="/login" className="profile">
            <span className="avatar">AM</span>
            <span>
              <strong>{user?.name ?? 'Demo workspace'}</strong>
              <small>{user ? 'Platform engineer' : 'Sign in to save changes'}</small>
            </span>
            <ChevronsUpDown size={14} />
          </Link>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="button button-ghost button-icon mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              {mobile ? <X size={19} /> : <Menu size={19} />}
            </button>
            <span className="muted">Workspace</span>
            <ChevronRight size={13} />
            <span>{current?.name ?? 'Settings'}</span>
            {path.split('/').length > 3 && (
              <>
                <ChevronRight size={13} />
                <span className="mono">{path.split('/').at(-1)}</span>
              </>
            )}
          </div>
          <div className="topbar-actions">
            <span className="demo-label">DEMO DATA</span>
            <label className="environment-select">
              <span className="live-dot" />
              <select
                aria-label="Environment"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as typeof environment)}
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
              </select>
              <ChevronDown size={12} />
            </label>
            <span className="topbar-divider" />
            <Button
              size="icon"
              variant="ghost"
              aria-label="Open command palette"
              title="Command palette (Ctrl+K)"
              onClick={() => setCommand(true)}
            >
              <Command size={17} />
            </Button>
            <Link
              className="button button-icon button-ghost"
              href="/architecture"
              aria-label="Help and architecture"
            >
              <CircleHelp size={17} />
            </Link>
            <span className="avatar avatar-small">AM</span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>
            <span className="live-dot" /> All collectors operational
          </span>
          <span>
            Snapshot · Sep 13, 2026 · 14:50 UTC{' '}
            <span className="footer-shortcut">⌘ K to navigate</span>
          </span>
        </footer>
      </div>
      <CommandPalette open={command} onOpenChange={setCommand} onCreate={() => setCreate(true)} />
      <CreateIncident open={create} onOpenChange={setCreate} />
    </div>
  );
}
export function CreateIncidentButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="default" onClick={() => setOpen(true)}>
        <Plus size={15} />
        Declare incident
      </Button>
      <CreateIncident open={open} onOpenChange={setOpen} />
    </>
  );
}
