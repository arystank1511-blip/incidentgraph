'use client';
import { useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/utils';
import { useHydrated } from './providers';
import { LoadingState, EmptyState } from './ui/primitives';
export function WorkspaceAccess({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const {
    data: user,
    isPending,
    error,
  } = useQuery({
    queryKey: ['session'],
    queryFn: () => api<{ name: string } | null>('/auth/me'),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    refetchInterval: 60000,
    refetchIntervalInBackground: true,
  });
  useEffect(() => {
    if (!isPending && !error && !user) window.location.replace('/login');
  }, [user, isPending, error]);
  if (!hydrated || isPending || !user)
    return error ? (
      <EmptyState title="Unable to verify your session" description="Reload to reconnect." />
    ) : (
      <LoadingState />
    );
  return children;
}
