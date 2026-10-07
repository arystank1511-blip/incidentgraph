'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { Incident } from '@incidentgraph/shared';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { useBootstrap, useWorkspace } from './providers';
import { api } from '@/lib/utils';
export function CreateIncident({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { environment, notify } = useWorkspace();
  const { data } = useBootstrap();
  const client = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const incident = await api<Incident>('/incidents', {
        method: 'POST',
        body: JSON.stringify({
          title: form.get('title'),
          severity: form.get('severity'),
          serviceIds: form.getAll('service'),
          environment,
          owner: form.get('owner'),
        }),
      });
      await client.invalidateQueries({ queryKey: ['bootstrap'] });
      onOpenChange(false);
      router.push(`/app/incidents/${incident.id}`);
      notify('Incident declared. Investigation is ready.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Declare an incident"
      description={`Start an investigation in ${environment}.`}
    >
      <form onSubmit={submit} className="form-stack">
        <label>
          Incident title
          <input
            name="title"
            required
            minLength={5}
            maxLength={180}
            placeholder="e.g. Elevated checkout error rate"
          />
        </label>
        <div className="form-columns">
          <label>
            Severity
            <select name="severity">
              <option>SEV-1</option>
              <option>SEV-2</option>
              <option>SEV-3</option>
              <option>SEV-4</option>
            </select>
          </label>
          <label>
            Incident commander
            <select name="owner">
              <option>Alex Morgan</option>
              <option>Jamie Chen</option>
              <option>Sarah Lee</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Affected services</legend>
          <div className="service-checkboxes">
            {data?.services.map((s) => (
              <label key={s.id}>
                <input type="checkbox" name="service" value={s.id} />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error} {error.includes('Sign in') && <a href="/login">Sign in to the demo</a>}
          </p>
        )}
        <Button type="submit" variant="default" disabled={busy}>
          {busy ? 'Creating…' : 'Declare incident'}
        </Button>
      </form>
    </Dialog>
  );
}
