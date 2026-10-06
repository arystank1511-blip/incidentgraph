import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';
import './workspace.css';
import './public.css';
// Each HTML response receives a fresh CSP nonce; never cache authenticated HTML.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: {
    default: 'IncidentGraph — Understand why your systems fail',
    template: '%s · IncidentGraph',
  },
  description:
    'Investigate distributed system incidents with correlated logs, metrics, traces, and dependency-aware root cause analysis.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
