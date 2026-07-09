import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="font-ui text-xs uppercase tracking-widest text-frh-text-muted">
        404 — Not Found
      </div>
      <h1 className="font-display text-3xl">This page checked out of the home.</h1>
      <p className="text-sm text-frh-text-muted max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" className="btn-secondary text-xs">&larr; Back Home</Link>
    </div>
  );
}
