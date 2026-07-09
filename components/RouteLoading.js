// Shared route-level loading state used by app/**/loading.js files.
// Server-renderable (no client hooks) so it streams instantly while the
// page's data fetches run.
export default function RouteLoading({ label = 'Loading' }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4" role="status" aria-live="polite">
      <div className="font-ui text-xs uppercase tracking-widest text-frh-text-muted animate-pulse">
        {label}…
      </div>
      <div className="w-40 h-1.5 border border-frh-border overflow-hidden">
        <div className="h-full w-1/3 bg-frh-yellow animate-pulse" />
      </div>
    </div>
  );
}
