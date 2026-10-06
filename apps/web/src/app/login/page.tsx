'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Network, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Logo } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/utils';
export default function Login() {
  const router = useRouter();
  const client = useQueryClient();
  const { data: authConfig } = useQuery({
    queryKey: ['auth-config'],
    queryFn: () => api<{ demoMode: boolean }>('/auth/config'),
  });
  const demo = authConfig?.demoMode === true;
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      await client.invalidateQueries({ queryKey: ['session'] });
      router.push('/app/overview');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <Link href="/" className="login-logo">
        <Logo />
      </Link>
      <div className="login-card">
        <span className="login-symbol">
          <Network size={27} />
        </span>
        <h1>Your next investigation starts here.</h1>
        <p>Sign in to access your workspace and investigation data.</p>
        <form key={String(demo)} className="form-stack" onSubmit={submit}>
          <label>
            Email address
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              defaultValue={demo ? 'demo@incidentgraph.dev' : ''}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              defaultValue={demo ? 'investigate-demo' : ''}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button variant="default" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : demo ? 'Enter demo workspace' : 'Sign in'}
            <ArrowRight size={15} />
          </Button>
        </form>
        <div className="login-note">
          <ShieldCheck size={15} />
          <span>
            {demo
              ? 'Shared synthetic demo. Do not enter confidential information.'
              : 'Private workspace. Use the credentials provided by your administrator.'}
          </span>
        </div>
      </div>
      <footer>INCIDENTGRAPH · BUILT FOR THE MOMENT IT MATTERS</footer>
    </main>
  );
}
