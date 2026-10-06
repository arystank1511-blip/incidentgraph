'use client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { EnvironmentName, Snapshot } from '@incidentgraph/shared';
import { api } from '@/lib/utils';
type Bootstrap = Omit<Snapshot, 'logs' | 'metrics'> & {
  storageMode: string;
  serviceTrends: Record<string, number[]>;
};
interface Workspace {
  environment: EnvironmentName;
  setEnvironment: (value: EnvironmentName) => void;
  notify: (message: string) => void;
}
const Context = createContext<Workspace | null>(null);
const subscribeMounted = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false,
  );
}
function subscribeEnvironment(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener('incidentgraph-environment', listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener('incidentgraph-environment', listener);
  };
}
let fallbackEnvironment: EnvironmentName = 'production';
function readEnvironment(): EnvironmentName {
  try {
    return localStorage.getItem('incidentgraph-environment') === 'staging'
      ? 'staging'
      : 'production';
  } catch {
    return fallbackEnvironment;
  }
}
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  const environment = useSyncExternalStore(
    subscribeEnvironment,
    readEnvironment,
    () => 'production' as EnvironmentName,
  );
  const setEnvironment = useCallback((value: EnvironmentName) => {
    fallbackEnvironment = value;
    try {
      localStorage.setItem('incidentgraph-environment', value);
    } catch {
      /* Private browsing: retain this tab preference. */
    }
    window.dispatchEvent(new Event('incidentgraph-environment'));
  }, []);
  const [toast, setToast] = useState('');
  const notify = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? '' : current)), 4500);
  }, []);
  return (
    <QueryClientProvider client={client}>
      <Context.Provider value={{ environment, setEnvironment, notify }}>
        {children}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </Context.Provider>
    </QueryClientProvider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('Workspace provider is required');
  return value;
}
export function useBootstrap() {
  const { environment } = useWorkspace();
  const hydrated = useHydrated();
  const result = useQuery({
    queryKey: ['bootstrap', environment],
    queryFn: () => api<Bootstrap>(`/bootstrap?environment=${environment}`),
  });
  return {
    ...result,
    data: hydrated ? result.data : undefined,
    isLoading: !hydrated || result.isLoading,
  };
}
