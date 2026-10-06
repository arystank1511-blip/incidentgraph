'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  GitBranch,
  Plus,
  Search,
  Terminal,
  TriangleAlert,
} from 'lucide-react';
import { Dialog } from './ui/dialog';
import { useWorkspace } from './providers';
import { api } from '@/lib/utils';
interface SearchResult {
  id: string;
  label: string;
  type: string;
  href: string;
}
export function CommandPalette({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const { environment, setEnvironment } = useWorkspace();
  const router = useRouter();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(timer);
  }, [query]);
  const { data: results = [] } = useQuery({
    queryKey: ['search', environment, debounced],
    queryFn: () =>
      api<SearchResult[]>(`/search?environment=${environment}&q=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length > 0,
  });
  const commands = [
    { label: 'Go to Incidents', href: '/app/incidents', icon: TriangleAlert },
    { label: 'Search Services', href: '/app/services', icon: Search },
    { label: 'Open Logs', href: '/app/logs', icon: Terminal },
    { label: 'Open Metrics', href: '/app/metrics', icon: Activity },
    { label: 'View Service Map', href: '/app/service-map', icon: GitBranch },
  ];
  const go = (href: string) => {
    router.push(href);
    onOpenChange(false);
    setQuery('');
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command center"
      description="Search incidents, services, logs, and traces. Use Tab and Enter to select."
    >
      <div className="command-input">
        <Search size={19} />
        <input
          aria-label="Global search"
          placeholder="Search anything, or jump to…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>esc</kbd>
      </div>
      <div className="command-results">
        {query ? (
          results.length ? (
            results.map((r) => (
              <button key={r.id} onClick={() => go(r.href)}>
                <Search size={16} />
                <span>{r.label}</span>
                <small>{r.type}</small>
                <ArrowRight size={14} />
              </button>
            ))
          ) : (
            <p className="muted command-empty">No matching telemetry.</p>
          )
        ) : (
          <>
            <div className="section-label">QUICK NAVIGATION</div>
            {commands.map((c) => (
              <button key={c.href} onClick={() => go(c.href)}>
                <c.icon size={16} />
                <span>{c.label}</span>
                <ArrowRight size={14} />
              </button>
            ))}
            <button
              onClick={() => {
                onOpenChange(false);
                onCreate();
              }}
            >
              <Plus size={16} />
              <span>Create Incident</span>
            </button>
            <button
              onClick={() => {
                setEnvironment(environment === 'production' ? 'staging' : 'production');
                onOpenChange(false);
              }}
            >
              <GitBranch size={16} />
              <span>Switch to {environment === 'production' ? 'staging' : 'production'}</span>
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}
