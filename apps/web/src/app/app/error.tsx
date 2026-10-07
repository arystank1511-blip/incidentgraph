'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1>We couldn’t load this investigation</h1>
      <p>Your saved changes are safe. Try loading the workspace again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
