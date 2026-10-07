import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="empty-state full-height">
      <h1>Nothing at this address</h1>
      <p>This investigation or page doesn’t exist.</p>
      <Link className="button button-primary" href="/app/overview">
        Back to overview
      </Link>
    </div>
  );
}
