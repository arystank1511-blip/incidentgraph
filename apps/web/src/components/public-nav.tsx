import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Logo } from './shell';
export function PublicNav() {
  return (
    <header className="public-nav">
      <Link href="/" aria-label="IncidentGraph home">
        <Logo />
      </Link>
      <nav aria-label="Public navigation">
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/architecture">Architecture</Link>
        <Link href="/app/overview">Product</Link>
      </nav>
      <Link href="/login" className="button button-primary">
        Explore demo
        <ArrowUpRight size={14} />
      </Link>
    </header>
  );
}
export function PublicFooter() {
  return (
    <footer className="public-footer">
      <Link href="/">
        <Logo />
      </Link>
      <span>Built for the engineers behind reliable systems.</span>
      <Link href="/architecture">
        Architecture
        <ArrowUpRight size={13} />
      </Link>
    </footer>
  );
}
